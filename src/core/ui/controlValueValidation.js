import {defaultDateInputMinDate,defaultDateInputMaxDate} from '../../packs/blueprint/dateInputBounds.js';
export const stringKinds=new Set(['text','email','textarea','radio','math']);
// HTML's email-input syntax, including local domains. No delivery/domain lookup.
// https://html.spec.whatwg.org/dev/input.html#email-state-(type=email)
const emailAddress=/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const boolKinds=new Set(['checkbox','toggle','switch','booleanPill']);
export const arrayKinds=new Set(['multiSelect','chipList','filterChips','treeMultiSelect']);
export const numericKinds=new Set(['number','currency','percentFraction2Input']);
export const dateKinds=new Set(['date','datetime']);
export function validateWidgetControlValue(value,{item={},props={}}={}) {
  const kind=item.widget || item.type;
  if(stringKinds.has(kind) && typeof value!=='string')return 'string value required';
  if(boolKinds.has(kind) && typeof value!=='boolean')return 'boolean value required';
  if(arrayKinds.has(kind) && !Array.isArray(value))return 'array value required';
  if(Array.isArray(value) && (props.minItems!=null && value.length<props.minItems || props.maxItems!=null && value.length>props.maxItems))return 'array length is outside allowed bounds';
  if(arrayKinds.has(kind) && Array.isArray(value) && new Set(value.map(item=>JSON.stringify(item))).size!==value.length)return 'duplicate values are unavailable';
  if(numericKinds.has(kind) && !(value===null && props.nullable===true) && (typeof value!=='number' || !Number.isFinite(value)))return 'finite number required';
  const validDay=day=>{if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const date=new Date(`${day}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;};
  if(dateKinds.has(kind) && value!=='' && value!==null) {
    if(typeof value!=='string' || !validDay(value.slice(0,10)) || !Number.isFinite(Date.parse(value)))return 'valid ISO date required';
    if(props.valueMode==='civil' && !validDay(value))return 'civil date must use YYYY-MM-DD';
    if(kind==='datetime' && !/T\d{2}:\d{2}/.test(value))return 'date-time with time required';
    const date=new Date(value),min=props.minDate?new Date(props.minDate):defaultDateInputMinDate(),max=props.maxDate?new Date(props.maxDate):defaultDateInputMaxDate();
    if(date<min||date>max)return 'date is outside allowed bounds';
  }
  if(kind==='dateRange') {
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['start','end'].includes(key)))return 'date range requires start/end fields';
    const range={...(props.value || {}),...value};
    if([range.start,range.end].some(day=>day && !validDay(day)))return 'valid civil dates required';
    if(range.start && range.end && range.start>range.end)return 'range start must precede end';
    if((item.required||props.required)&&(!range.start||!range.end))return 'complete date range required';
  }
  if(kind==='percentFraction2Input' && (value<0 || value>1))return 'fraction must be between zero and one';
  if((item.required || props.required) && (value==null || value==='' || Array.isArray(value)&&!value.length))return 'value is required';
  if(kind==='email') {
    if(value==='')return null;
    if(!(props.multiple ? value.split(',').every(address=>emailAddress.test(address.trim())) : emailAddress.test(value)))return 'valid email address required';
  }
  if(typeof value==='string') {
    if(Number.isInteger(props.maxLength) && value.length>props.maxLength)return 'maximum length exceeded';
    if(Number.isInteger(props.minLength) && value.length<props.minLength)return 'minimum length not met';
    if(props.pattern && !new RegExp(`^(?:${props.pattern})$`).test(value))return 'pattern does not match';
  }
  if(typeof value==='number' && (props.min!=null && value<props.min || props.max!=null && value>props.max))return 'number is outside allowed bounds';
  if(['select','multiSelect','filterChips','treeMultiSelect'].includes(kind)) {
    if(!Array.isArray(props.options))return 'options are not loaded';
    const values=Array.isArray(value)?value:[value];
    if(values.some(v=>!props.options.some(option=>Object.is(option?.value??option,v)&&option?.disabled!==true)))return 'option is unavailable or disabled';
  }
  return null;
}
