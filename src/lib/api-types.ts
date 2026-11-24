/**
 * Request and response shapes generated from navo-api's OpenAPI description
 * (`npm run api:types` writes api-schema.d.ts from ../navo-api/api/openapi.json).
 * New code takes its API types from here instead of writing them by hand.
 */
import type { components } from "./api-schema";

type Schemas = components["schemas"];

export type Role = Schemas["Role"];
export type Principal = Schemas["Principal"];
export type AdminUser = Schemas["User"];
export type Invite = Schemas["Invite"];
export type InviteeInfo = Schemas["InviteeInfo"];
export type ServiceVisit = Schemas["ServiceVisit"];
export type ServiceVisitLine = Schemas["ServiceVisitLine"];
export type Equipment = Schemas["Equipment"];
export type FieldPerson = Schemas["FieldPerson"];
