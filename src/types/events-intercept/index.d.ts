import { EventEmitter } from 'events';

export function patch(emitter: EventEmitter): void;

export interface InterceptedEventEmitter extends EventEmitter {
  intercept(
    event: string,
    cb: (arg: any, done: (err: Error | null, returnVal: any) => void) => void,
  ): void;
}
