import { describe, expect, it } from 'vitest'
import { schemaMigrationStatements, schemaStatements } from '../src/schema'

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

  it('微信身份独立关联用户且不保存 session_key', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS wechat_accounts')
    expect(sql).toContain('CONSTRAINT uk_wechat_accounts_openid UNIQUE (openid)')
    expect(sql).toContain('fk_wechat_accounts_user')
    expect(sql).not.toContain('session_key')
  })

  it('微信首次登录需要设置昵称，并为已有数据库提供增量迁移', () => {
    expect(sql).toContain('nickname_required TINYINT(1) NOT NULL DEFAULT 1')
    expect(schemaMigrationStatements.join('\n')).toContain('ADD COLUMN nickname_required')
  })
})
