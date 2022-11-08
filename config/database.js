'use strict'

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use('Env')

/** @type {import('@adonisjs/ignitor/src/Helpers')} */
const Helpers = use('Helpers')

module.exports = {
  /*
  |--------------------------------------------------------------------------
  | Default Connection
  |--------------------------------------------------------------------------
  |
  | Connection defines the default connection settings to be used while
  | interacting with SQL databases.
  |
  */
  connection: Env.get('DEFAULT_DB_CONNECTION', 'mssql'),

  /*
  |--------------------------------------------------------------------------
  | Sqlite
  |--------------------------------------------------------------------------
  |
  | Sqlite is a flat file database and can be a good choice for a development
  | environment.
  |
  | npm i --save sqlite3
  |
  */
  sqlite: {
    client: 'sqlite3',
    connection: {
      filename: Helpers.databasePath(`${Env.get('DB_DATABASE', 'development')}.sqlite`)
    },
    useNullAsDefault: true,
    debug: Env.get('DB_DEBUG', false)
  },

  /*
  |--------------------------------------------------------------------------
  | MySQL
  |--------------------------------------------------------------------------
  |
  | Here we define connection settings for MySQL database.
  |
  | npm i --save mysql
  |
  */
  mysql: {
    client: 'mysql',
    connection: {
      host: Env.get('SQL_DB_HOST', 'localhost'),
      port: Env.get('SQL_DB_PORT', ''),
      user: Env.get('DB_USER', 'root'),
      password: Env.get('DB_PASSWORD', ''),
      database: Env.get('DB_DATABASE', 'adonis')
    },
    debug: Env.get('DB_DEBUG', false)
  },

  /*
  |--------------------------------------------------------------------------
  | PostgreSQL
  |--------------------------------------------------------------------------
  |
  | Here we define connection settings for PostgreSQL database.
  |
  | npm i --save pg
  |
  */
  pg: {
    client: 'pg',
    connection: {
      host: Env.get('PG_DB_HOST', 'localhost'),
      port: Env.get('PG_DB_PORT', ''),
      user: Env.get('PG_DB_USER', 'root'),
      password: Env.get('PG_DB_PASSWORD', ''),
      database: Env.get('PG_DB_DATABASE', 'adonis')
    },
    debug: Env.get('DB_DEBUG', false)
  },

  mssql: {
    client: 'mssql',
    connection: {
      host: Env.get('SQL_DB_HOST'),
      port: Env.get('SQL_DB_PORT'),
      user: Env.get('SQL_DB_USER'),
      password: Env.get('SQL_DB_PASSWORD'),
      database: Env.get('SQL_DB_DATABASE')
    }
  },

  old_mssql: {
    client: 'mssql',
    connection: {
      host: Env.get('OLD_SQL_DB_HOST'),
      port: Env.get('OLD_SQL_DB_PORT'),
      user: Env.get('OLD_SQL_DB_USER'),
      password: Env.get('OLD_SQL_DB_PASSWORD'),
      database: Env.get('OLD_SQL_DB_DATABASE')
    }
  },
}
