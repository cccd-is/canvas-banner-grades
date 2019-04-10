'use strict';
let Banner = require('./BannerDatabase');
let Logger = require('winston');
let JetPack = require('fs-jetpack');

const sqlGetSectionGrades = JetPack.read('src/server/banner/sql/GetSectionGrades.sql');
const sqlGetUserPidm = JetPack.read('src/server/banner/sql/GetUserPidm.sql');
const sqlCheckSection = JetPack.read('src/server/banner/sql/CheckSection.sql');
const sqlCheckIfPrimaryInstructor = JetPack.read('src/server/banner/sql/CheckIfPrimaryInstructor.sql');




async function checkSection(term, crn) {
	let result = await Banner.sql(sqlCheckSection, {
		term,
		crn
	});
	Logger.info('Section check results', {
		result
	})
	return Banner.unwrapRows(result);
}


async function checkIfPrimary(term, cNumber) {
	let results = await Banner.sql(sqlCheckIfPrimaryInstructor, {
		term: term,
		cNumber: cNumber
	});
	Logger.info('Primary Check results', {
		results
	});
	return Banner.unwrapRows(results);
}
async function getSectionGrades(term, crn, reg_codes) {
        let sql = sqlGetSectionGrades; 
        sql += ' and sfrstcr_rsts_code in (';
        for(let i = 0; i < reg_codes.length; i++){
		sql += "'" + reg_codes[i] + "'";
                if( (i + 1) < reg_codes.length){
			sql += ","
		}
	}
	sql += ')';
	let results = await Banner.sql(sql, {
		term: term,
		crn: crn,

	})
	Logger.info('Get section grades results', {
		results
	})
	return Banner.unwrapRows(results);
}


async function syncGrade(term, crn, studentPidm, teacherPidm, grade) {
	Logger.info('Before Syncing Grade', {
		term,
		crn,
		studentPidm,
		teacherPidm,
		grade
	});
	let results = await Banner.sql(`begin baninst1.sp_grading.p_post_grade(:term,:studentPidm,:crn,:teacherPidm,'F', :grade); end;`, {
		term,
		crn,
		studentPidm,
		teacherPidm,
		grade
	})
	Logger.info('Grade Sync results', {
		results
	});
	return Banner.unwrapRows(results);

}

async function getUserPidm(cNumber) {
	let results = await Banner.sql(sqlGetUserPidm, {
		cNumber
	});
	Logger.info('Get User Pidm results', {
		results
	});
	return Banner.unwrapRows(results);
}

module.exports = {
	getSectionGrades,
	getUserPidm,
	syncGrade,
	checkIfPrimary,
	checkSection
}
