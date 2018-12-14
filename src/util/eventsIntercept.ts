import { EventEmitter } from 'events';

import { InterceptedEventEmitter, patch } from 'events-intercept';

export default function eventsIntercept<T extends EventEmitter>(obj: T) {
  patch(obj);
  return obj as T & InterceptedEventEmitter;
}
