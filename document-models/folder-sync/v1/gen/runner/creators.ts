/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  FinishRunInputSchema,
  ResolveIssueInputSchema,
  SetIssuesInputSchema,
  StartRunInputSchema,
} from "../schema/zod.js";
import type {
  FinishRunInput,
  ResolveIssueInput,
  SetIssuesInput,
  StartRunInput,
} from "../types.js";
import type {
  FinishRunAction,
  ResolveIssueAction,
  SetIssuesAction,
  StartRunAction,
} from "./actions.js";

export const startRun = (input: StartRunInput) =>
  createAction<StartRunAction>(
    "START_RUN",
    { ...input },
    undefined,
    StartRunInputSchema,
    "global",
  );

export const finishRun = (input: FinishRunInput) =>
  createAction<FinishRunAction>(
    "FINISH_RUN",
    { ...input },
    undefined,
    FinishRunInputSchema,
    "global",
  );

export const setIssues = (input: SetIssuesInput) =>
  createAction<SetIssuesAction>(
    "SET_ISSUES",
    { ...input },
    undefined,
    SetIssuesInputSchema,
    "global",
  );

export const resolveIssue = (input: ResolveIssueInput) =>
  createAction<ResolveIssueAction>(
    "RESOLVE_ISSUE",
    { ...input },
    undefined,
    ResolveIssueInputSchema,
    "global",
  );
