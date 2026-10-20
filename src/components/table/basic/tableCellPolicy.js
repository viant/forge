import {evaluatePlainVisibleWhen,trackVisibleWhen} from '../../visibleWhen.js';

export function tableCellPolicy(column, row, context) {
 for(const condition of [column.visibleWhen,column.hiddenWhen,column.disabledWhen,column.readOnlyWhen])trackVisibleWhen(condition,context);
 return {
  visible:(!column.visibleWhen||evaluatePlainVisibleWhen(column.visibleWhen,context,row))&&(!column.hiddenWhen||!evaluatePlainVisibleWhen(column.hiddenWhen,context,row)),
  disabled:Boolean(column.disabledWhen&&evaluatePlainVisibleWhen(column.disabledWhen,context,row)),
  readOnly:Boolean(column.readOnlyWhen&&evaluatePlainVisibleWhen(column.readOnlyWhen,context,row)),
 };
}
