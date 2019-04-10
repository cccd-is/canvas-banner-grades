'use strict';
let Config = require('../../../lti.config.json');
let Logger = require('winston');
let Oracle = require('oracledb');

function getConnection() {
    return oraclePool.then(() => {
            return Oracle.getConnection('banner');
        })
        .catch(error => {
            Logger.error(`An error occurred while getting a connection to Banner from the pool`, error);
        });
}

async function sql(statement, params = {}, options = {}) {
    let connection;
    try {
        connection = await getConnection();
        return await connection.execute(statement, params, options);

    } finally {
        connection.close();
    }
}

function unwrapObject(result) {
    return result.rows[0];
}

function unwrapRows(result) {
    return result.rows;
}

Oracle.autoCommit = true;
Oracle.maxRows = 100000;
Oracle.outFormat = Oracle.OBJECT;

let oraclePool = Oracle.createPool(Config.banner)
    .then(() => {
        Logger.info(`Created Oracle connection pool to Banner`, {
            instance: Config.banner.connectString
        });
    })
    .catch(error => {
        Logger.error(`An error occurred while creating the Banner connection pool`, error);
    });

module.exports = {
    getConnection: getConnection,
    sql: sql,
    unwrapObject: unwrapObject,
    unwrapRows: unwrapRows
}