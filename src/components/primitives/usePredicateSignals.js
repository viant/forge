import {useSignals} from '@preact/signals-react/runtime';

export function usePredicateSignals(context) {
  useSignals();
  context?.signals?.form?.value;
  context?.signals?.windowForm?.value;
  context?.signals?.selection?.value;
  context?.signals?.authorization?.value;
  context?.signals?.input?.value;
  context?.signals?.metrics?.value;
  context?.signals?.collection?.value;
  context?.signals?.control?.value;
}
