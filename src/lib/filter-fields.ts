import type { FilterField, FilterOp } from './types'

export type FilterDataType =
  | 'enum'
  | 'entity'
  | 'date'
  | 'number'
  | 'boolean'
  | 'text'

export type FilterFieldDefinition = {
  key: FilterField
  label: string
  dataType: FilterDataType
  operators: FilterOp[]
  multiple?: boolean
}

export const FILTER_FIELDS: FilterFieldDefinition[] = [
  {
    key: 'stateId',
    label: 'Status',
    dataType: 'entity',
    operators: ['eq', 'neq'],
  },
  {
    key: 'assigneeId',
    label: 'Assignee',
    dataType: 'entity',
    operators: ['eq', 'neq'],
  },
  {
    key: 'priority',
    label: 'Priority',
    dataType: 'enum',
    operators: ['eq', 'neq'],
  },
  {
    key: 'labelId',
    label: 'Label',
    dataType: 'entity',
    operators: ['eq', 'neq'],
    multiple: true,
  },
  {
    key: 'projectId',
    label: 'Project',
    dataType: 'entity',
    operators: ['eq', 'neq'],
  },
  {
    key: 'cycleId',
    label: 'Cycle',
    dataType: 'entity',
    operators: ['eq', 'neq'],
  },
]
