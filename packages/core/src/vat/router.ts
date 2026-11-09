import {
  buildVatReport,
  computeDp3,
  generateDp3Xml,
  generateKhXml,
  generateShXml,
  taxpayerDicDigits,
  todayPrague,
  type VatPeriod,
  type VatReport,
  type VatTaxpayer,
  vatFilingDeadline,
  vatPeriodRange,
} from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BRAND } from '../brand'
import { procedure } from '../orpc'
import { vatRepo } from './repo'

const tag = ['VAT reports']

const amount = z
  .string()
  .regex(/^-?\d+([.,]\d{1,2})?$/, 'Částka ve tvaru 1234 nebo 1234,50')
  .transform((v) => v.replace(',', '.'))

const periodFields = {
  year: z.number().int().min(2016).max(2100),
  month: z.number().int().min(1).max(12).optional().describe('Calendar month (monthly payers)'),
  quarter: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe('Calendar quarter (quarterly payers)'),
}

const optionFields = {
  euSupplyKind: z
    .enum(['services', 'goods'])
    .default('services')
    .describe(
      'Whether EU reverse-charge supplies are services (ř.21, SH code 3) or goods (ř.20, code 0)',
    ),
  reverseChargeCode: z
    .string()
    .regex(/^(1a?|3a?|4a?|5|6|7|1[1-9]|2[01])$/)
    .default('4')
    .describe('KH A.1 code of the supply (kód předmětu plnění), e.g. 4 = construction work'),
  inputVat: z
    .object({
      r40Base: amount.optional(),
      r40Deduction: amount.optional(),
      r41Base: amount.optional(),
      r41Deduction: amount.optional(),
    })
    .optional()
    .describe(
      'Manually entered input VAT (received invoices are not tracked): ř.40 (21 %) and ř.41 (12 %)',
    ),
}

const onePeriod = (v: { month?: number | undefined; quarter?: number | undefined }) =>
  (v.month === undefined) !== (v.quarter === undefined)
const onePeriodMessage = { message: 'Provide exactly one of month or quarter' }

const reportInput = z
  .object({ ...periodFields, ...optionFields })
  .refine(onePeriod, onePeriodMessage)
const exportInput = z
  .object({ ...periodFields, ...optionFields, kind: z.enum(['dp3', 'kh', 'sh']) })
  .refine(onePeriod, onePeriodMessage)

function periodOf(i: { year: number; month?: number; quarter?: number }): VatPeriod {
  return i.month !== undefined
    ? { kind: 'month', year: i.year, month: i.month }
    : { kind: 'quarter', year: i.year, quarter: i.quarter as number }
}

const pair = z.object({ base: z.string(), vat: z.string() })

const reportOutput = z.object({
  period: z.object({
    kind: z.enum(['month', 'quarter']),
    year: z.number(),
    month: z.number().optional(),
    quarter: z.number().optional(),
  }),
  range: z.object({ from: z.string(), to: z.string() }),
  deadline: z
    .string()
    .describe('Filing deadline (25 days after the end of the period, weekends skipped)'),
  filingPeriod: z.enum(['monthly', 'quarterly']).nullable(),
  dp3: z.record(z.string(), pair),
  dp3Figures: z.record(z.string(), z.unknown()),
  kh: z.object({
    a1: z.array(
      z.object({
        documentId: z.string(),
        number: z.string(),
        dicOdb: z.string(),
        duzp: z.string(),
        base: z.string(),
        code: z.string(),
      }),
    ),
    a4: z.array(
      z.object({
        documentId: z.string(),
        number: z.string(),
        dicOdb: z.string(),
        dppd: z.string(),
        base21: z.string(),
        vat21: z.string(),
        base12: z.string(),
        vat12: z.string(),
      }),
    ),
    a5: z.object({ base21: z.string(), vat21: z.string(), base12: z.string(), vat12: z.string() }),
  }),
  sh: z.array(
    z.object({
      country: z.string(),
      vatNumber: z.string(),
      code: z.enum(['0', '3']),
      count: z.number(),
      valueCzk: z.string(),
      valueWhole: z.string(),
    }),
  ),
  contributions: z.array(
    z.object({ rowKey: z.string(), documentId: z.string(), base: z.string(), vat: z.string() }),
  ),
  documents: z.record(
    z.string(),
    z.object({
      id: z.string(),
      number: z.string(),
      type: z.enum(['invoice', 'credit_note', 'payment_receipt']),
      taxableDate: z.string(),
      customerName: z.string(),
      currency: z.string(),
      totalCzk: z.string(),
    }),
  ),
  warnings: z.array(
    z.object({
      code: z.string(),
      blocking: z.boolean(),
      documentId: z.string(),
      number: z.string(),
    }),
  ),
  advisories: z.array(z.string()).describe('Period advisories, e.g. kh_monthly_for_legal_entity'),
  documentCount: z.number(),
  filing: z.object({ ready: z.boolean(), missing: z.array(z.string()) }),
  disclaimer: z.string(),
})

export const VAT_DISCLAIMER = 'Kontrolujte před podáním — aplikace nenahrazuje daňového poradce.'

async function requirePayer(ctx: {
  db: Parameters<typeof vatRepo.profile>[0]
  principal: { organizationId: string }
}) {
  const profile = await vatRepo.profile(ctx.db, ctx.principal.organizationId)
  if (!profile || profile.vatStatus !== 'payer') {
    throw new ORPCError('PRECONDITION_FAILED', {
      message:
        'VAT reports are available to VAT payers only (set the VAT status in the business profile)',
    })
  }
  return profile
}

type Profile = Awaited<ReturnType<typeof requirePayer>>

function taxpayerOf(profile: Profile): { taxpayer: VatTaxpayer | null; missing: string[] } {
  const missing: string[] = []
  let dic: string | null = null
  try {
    dic = profile.dic ? taxpayerDicDigits(profile.dic) : null
  } catch {
    dic = null
  }
  if (!dic) missing.push('dic')
  const f = profile.vatFiling
  if (!f) missing.push('vatFiling')
  if (!dic || !f) return { taxpayer: null, missing }
  return {
    missing,
    taxpayer: {
      dic,
      taxOfficeCode: f.taxOfficeCode,
      workplaceCode: f.workplaceCode ?? null,
      type: f.subjectType,
      name: profile.legalName,
      street: profile.address.street ?? null,
      city: profile.address.city ?? null,
      zip: profile.address.zip ?? null,
      email: profile.email,
    },
  }
}

async function compute(
  ctx: { db: Parameters<typeof vatRepo.profile>[0]; principal: { organizationId: string } },
  profile: Profile,
  input: z.output<typeof reportInput> | z.output<typeof exportInput>,
) {
  const period = periodOf(input)
  const range = vatPeriodRange(period)
  const { documents, info } = await vatRepo.documentsForRange(
    ctx.db,
    ctx.principal.organizationId,
    range,
  )
  const report = buildVatReport(period, documents, {
    euSupplyKind: input.euSupplyKind,
    reverseChargeCode: input.reverseChargeCode,
  })
  return { period, range, report, info, profile }
}

function advisories(report: VatReport, subjectType: 'F' | 'P' | undefined): string[] {
  const out: string[] = []
  if (subjectType === 'P' && report.period.kind === 'quarter')
    out.push('kh_monthly_for_legal_entity')
  if (report.period.kind === 'quarter' && report.sh.some((r) => r.code === '0')) {
    out.push('sh_monthly_when_goods')
  }
  return out
}

export const vatRouter = {
  report: procedure({
    mcp: {
      name: 'get_vat_report',
      title: 'VAT report preview (DPH rows, kontrolní hlášení, souhrnné hlášení) for a period',
      readOnly: true,
      description:
        'Aggregates the issued tax documents of a month/quarter into rows of the VAT return (ř.1, 2, 20, 21, 22, 25, 26), control statement sections A.1/A.4/A.5 and recapitulative statement rows, with warnings. Output VAT only; input VAT is entered manually. Always remind the user to check the numbers before filing.',
    },
    openapi: {
      method: 'GET',
      path: '/vat/report',
      summary:
        'Preview of VAT return, control statement and recapitulative statement rows for a period (VAT payers)',
      tags: tag,
    },
  })
    .input(reportInput)
    .output(reportOutput)
    .handler(async ({ context, input }) => {
      const profile = await requirePayer(context)
      const { period, range, report, info } = await compute(context, profile, input)
      const { missing } = taxpayerOf(profile)
      const used = new Set(report.contributions.map((c) => c.documentId))
      for (const w of report.warnings) used.add(w.documentId)
      const documents: Record<string, (typeof info)[string]> = {}
      for (const id of used) {
        const d = info[id]
        if (d) documents[id] = d
      }
      return {
        period: {
          kind: period.kind,
          year: period.year,
          ...(period.kind === 'month' ? { month: period.month } : { quarter: period.quarter }),
        },
        range,
        deadline: vatFilingDeadline(period),
        filingPeriod: profile.vatFiling?.period ?? null,
        dp3: report.dp3,
        dp3Figures: computeDp3(report, input.inputVat ?? {}) as unknown as Record<string, unknown>,
        kh: report.kh,
        sh: report.sh,
        contributions: report.contributions,
        documents,
        warnings: report.warnings,
        advisories: advisories(report, profile.vatFiling?.subjectType),
        documentCount: report.documentCount,
        filing: { ready: missing.length === 0, missing },
        disclaimer: VAT_DISCLAIMER,
      }
    }),

  exportXml: procedure({
    mcp: {
      name: 'export_vat_xml',
      title:
        'Generate EPO XML (přiznání k DPH, kontrolní hlášení or souhrnné hlášení) for upload to mojedane.cz',
      readOnly: true,
      description:
        'Generates the XML file for the Finanční správa EPO portal from the issued documents of a period. The user must upload and submit it themselves. Remind them: Kontrolujte před podáním — aplikace nenahrazuje daňového poradce.',
    },
    openapi: {
      method: 'GET',
      path: '/vat/export',
      summary:
        'EPO XML file of the VAT return (dp3), control statement (kh) or recapitulative statement (sh)',
      tags: tag,
    },
  })
    .input(exportInput)
    .output(z.object({ filename: z.string(), contentType: z.string(), xml: z.string() }))
    .handler(async ({ context, input }) => {
      const profile = await requirePayer(context)
      const { taxpayer, missing } = taxpayerOf(profile)
      if (!taxpayer) {
        throw new ORPCError('PRECONDITION_FAILED', {
          message: `Doplňte údaje pro podání (${missing.join(', ')})`,
          data: { missing },
        })
      }
      const { period, report } = await compute(context, profile, input)
      const opts = {
        filedOn: todayPrague(),
        software: { name: BRAND.name, version: '1' },
      }
      const stamp =
        period.kind === 'month'
          ? `${period.year}-${String(period.month).padStart(2, '0')}`
          : `${period.year}-Q${period.quarter}`
      let xml: string
      let name: string
      if (input.kind === 'dp3') {
        xml = generateDp3Xml(report, taxpayer, input.inputVat ?? {}, opts)
        name = 'priznani-dph'
      } else if (input.kind === 'kh') {
        xml = generateKhXml(report, taxpayer, opts)
        name = 'kontrolni-hlaseni'
      } else {
        xml = generateShXml(report, taxpayer, opts)
        name = 'souhrnne-hlaseni'
      }
      return { filename: `${name}-${stamp}.xml`, contentType: 'application/xml', xml }
    }),
}
