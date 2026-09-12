import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSchema,
  isEnumType,
  isInputObjectType,
  isObjectType,
  isScalarType,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql'
import { loadTypeDefs } from '../yoga.ts'

const here = dirname(fileURLToPath(import.meta.url))

function unwrap(type: GraphQLOutputType | GraphQLInputType): {
  named: GraphQLNamedType
  list: boolean
  nullable: boolean
} {
  let current: GraphQLOutputType | GraphQLInputType = type
  let list = false
  let nullable = true
  while ('ofType' in current) {
    const name = current.constructor.name
    if (name === 'GraphQLNonNull') {
      nullable = false
      current = (current as { ofType: GraphQLOutputType | GraphQLInputType }).ofType
      continue
    }
    if (name === 'GraphQLList') {
      list = true
      current = (current as { ofType: GraphQLOutputType | GraphQLInputType }).ofType
      continue
    }
    break
  }
  return { named: current as GraphQLNamedType, list, nullable }
}

function tsNamed(type: GraphQLNamedType): string {
  switch (type.name) {
    case 'ID':
    case 'String':
      return 'string'
    case 'Int':
    case 'Float':
      return 'number'
    case 'Boolean':
      return 'boolean'
    case 'JSON':
      return 'unknown'
    default:
      return type.name
  }
}

function tsType(type: GraphQLOutputType | GraphQLInputType): string {
  const { named, list, nullable } = unwrap(type)
  let result = tsNamed(named)
  if (list) result = `Array<${result}>`
  if (nullable) result = `${result} | null`
  return result
}

function generate(schema: GraphQLSchema): string {
  const lines: string[] = [
    '/* Generated from server/graphql/schema.graphql — run `npm run graphql:types`. */',
    '',
    'export type Maybe<T> = T | null',
    '',
  ]
  const typeMap = schema.getTypeMap()
  for (const type of Object.values(typeMap)) {
    if (type.name.startsWith('__')) continue
    if (isScalarType(type)) continue
    if (isEnumType(type)) {
      const values = type.getValues().map((value) => `'${value.name}'`)
      lines.push(`export type ${type.name} = ${values.join(' | ')}`, '')
      continue
    }
    if (isObjectType(type) || isInputObjectType(type)) {
      const fields = isObjectType(type) ? type.getFields() : type.getFields()
      const body = Object.values(fields)
        .map((field) => {
          const optional = isInputObjectType(type) && unwrap(field.type).nullable ? '?' : ''
          return `  ${field.name}${optional}: ${tsType(field.type)}`
        })
        .join('\n')
      lines.push(`export interface ${type.name} {`, body, '}', '')
    }
  }
  return `${lines.join('\n').trim()}\n`
}

export async function generateGraphqlTypes(): Promise<string> {
  const typeDefs = await loadTypeDefs()
  const schema = buildSchema(typeDefs)
  return generate(schema)
}

async function main(): Promise<void> {
  const source = await generateGraphqlTypes()
  const targets = [
    join(here, '../../src/lib/graphql/generated.ts'),
    join(here, 'generated.ts'),
  ]
  for (const target of targets) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  console.log(`[nock] generated GraphQL types (${source.length} bytes)`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  await main()
}
