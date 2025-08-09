/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as runs from "../runs.js";
import type * as sources from "../sources.js";
import type * as steps from "../steps.js";
import type * as tool_calls from "../tool_calls.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chats: typeof chats;
  credits: typeof credits;
  crons: typeof crons;
  documents: typeof documents;
  files: typeof files;
  http: typeof http;
  runs: typeof runs;
  sources: typeof sources;
  steps: typeof steps;
  tool_calls: typeof tool_calls;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
