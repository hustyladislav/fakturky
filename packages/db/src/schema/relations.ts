import { relations } from 'drizzle-orm'
import {
  account,
  apikey,
  invitation,
  member,
  oauthAccessToken,
  oauthClient,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
  organization,
  passkey,
  session,
  user,
} from './auth'

// Better Auth resolves database joins through `db.query` relations; key names follow its
// convention (singular model name for "one", plural for "many").

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  members: many(member),
  invitations: many(invitation),
  oauthClients: many(oauthClient),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}))

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, { fields: [passkey.userId], references: [user.id] }),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}))

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, { fields: [member.userId], references: [user.id] }),
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}))

export const apikeyRelations = relations(apikey, () => ({}))

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
  oauthClientResources: many(oauthClientResource),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}))

export const oauthResourceRelations = relations(oauthResource, ({ many }) => ({
  oauthClientResources: many(oauthClientResource),
}))

export const oauthClientResourceRelations = relations(oauthClientResource, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthClientResource.clientId],
    references: [oauthClient.clientId],
  }),
  oauthResource: one(oauthResource, {
    fields: [oauthClientResource.resourceId],
    references: [oauthResource.identifier],
  }),
}))

export const oauthRefreshTokenRelations = relations(oauthRefreshToken, ({ one, many }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthRefreshToken.clientId],
    references: [oauthClient.clientId],
  }),
  session: one(session, {
    fields: [oauthRefreshToken.sessionId],
    references: [session.id],
  }),
  user: one(user, {
    fields: [oauthRefreshToken.userId],
    references: [user.id],
  }),
  oauthAccessTokens: many(oauthAccessToken),
}))

export const oauthAccessTokenRelations = relations(oauthAccessToken, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthAccessToken.clientId],
    references: [oauthClient.clientId],
  }),
  session: one(session, {
    fields: [oauthAccessToken.sessionId],
    references: [session.id],
  }),
  user: one(user, {
    fields: [oauthAccessToken.userId],
    references: [user.id],
  }),
  oauthRefreshToken: one(oauthRefreshToken, {
    fields: [oauthAccessToken.refreshId],
    references: [oauthRefreshToken.id],
  }),
}))

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}))
