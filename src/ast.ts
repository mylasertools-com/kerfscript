// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import type { Pos } from './lexer.js';

export type Expr =
  | { kind: 'num'; value: number; pos: Pos }
  | { kind: 'str'; value: string; pos: Pos }
  | { kind: 'bool'; value: boolean; pos: Pos }
  | { kind: 'undef'; pos: Pos }
  | { kind: 'var'; name: string; pos: Pos }
  | { kind: 'list'; items: ListItem[]; pos: Pos }
  | { kind: 'range'; start: Expr; step: Expr | null; end: Expr; pos: Pos }
  | { kind: 'unary'; op: string; arg: Expr; pos: Pos }
  | { kind: 'binary'; op: string; left: Expr; right: Expr; pos: Pos }
  | { kind: 'ternary'; cond: Expr; then: Expr; else: Expr; pos: Pos }
  | { kind: 'index'; target: Expr; index: Expr; pos: Pos }
  | { kind: 'member'; target: Expr; name: string; pos: Pos }
  | { kind: 'call'; callee: Expr; args: Arg[]; pos: Pos }
  | { kind: 'lambda'; params: Param[]; body: Expr; pos: Pos }
  | { kind: 'let'; assigns: Assign[]; body: Expr; pos: Pos };

export type ListItem =
  | { kind: 'item'; expr: Expr }
  | { kind: 'each'; expr: Expr }
  | { kind: 'for'; assigns: Assign[]; body: ListItem }
  | { kind: 'if'; cond: Expr; then: ListItem; else: ListItem | null }
  | { kind: 'let'; assigns: Assign[]; body: ListItem };

export interface Arg {
  name: string | null;
  value: Expr;
}

export interface Param {
  name: string;
  default: Expr | null;
}

export interface Assign {
  name: string;
  value: Expr;
  pos: Pos;
}

export type Stmt =
  | { kind: 'assign'; name: string; value: Expr; pos: Pos }
  | { kind: 'module'; name: string; params: Param[]; body: Stmt[]; pos: Pos }
  | { kind: 'function'; name: string; params: Param[]; body: Expr; pos: Pos }
  | { kind: 'call'; name: string; args: Arg[]; children: Stmt[]; modifier: string | null; pos: Pos }
  | { kind: 'for'; assigns: Assign[]; body: Stmt[]; pos: Pos }
  | { kind: 'if'; cond: Expr; then: Stmt[]; else: Stmt[]; pos: Pos }
  | { kind: 'let'; assigns: Assign[]; body: Stmt[]; pos: Pos }
  | { kind: 'block'; body: Stmt[]; pos: Pos }
  | { kind: 'use'; path: string; include: boolean; pos: Pos };

export interface Program {
  body: Stmt[];
}
