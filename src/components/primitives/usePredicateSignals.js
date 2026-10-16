import {useSignals} from '@preact/signals-react/runtime';
import {trackVisibleWhen} from '../visibleWhen.js';

export function usePredicateSignals(context, conditions = null) {
  useSignals();
  if (Array.isArray(conditions)) {
    conditions.forEach(condition => trackVisibleWhen(condition, context));
    return;
  }
  context?.signals?.form?.value;
  context?.signals?.windowForm?.value;
  context?.signals?.selection?.value;
  context?.signals?.authorization?.value;
  context?.signals?.input?.value;
  context?.signals?.metrics?.value;
  context?.signals?.collection?.value;
  context?.signals?.control?.value;
}
