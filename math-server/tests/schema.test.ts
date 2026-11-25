import { describe, expect, it } from 'vitest'
import { schemaStatements } from '../src/schema'

const sql = schemaStatements.join('\n')

describe('MySQL 建表语句', () => {
  it('使用 MySQL 自增、布尔及 InnoDB 语法', () => {
    expect(sql).toContain('AUTO_INCREMENT')
    expect(sql).toContain('TINYINT(1)')
    expect(sql).toContain('ENGINE=InnoDB')
    expect(sql).toContain('utf8mb4_unicode_ci')
  })

  it('不包含 PostgreSQL 专用语法', () => {
    expect(sql).not.toMatch(/\$\d+|RETURNING|TIMESTAMPTZ|GENERATED ALWAYS|CREATE INDEX IF NOT EXISTS/i)
  })
})
