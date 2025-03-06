/**
 * Common utilities and base classes for the AV Controls system
 */

import * as Base from './controls/base';

export type SpecsDict = {[id: string]: Base.Spec};
export type ReceiversDict = {[id: string]: Base.Receiver};
export type SendersDict = {[id: string]: Base.Sender};

export type ControlId = string[]

export function controlIdsEqual(a: ControlId, b: ControlId) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export class Mapping {
}
