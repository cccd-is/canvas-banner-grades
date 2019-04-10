'use strict'
const https = require('https');
const CanvasApiClient = require('./CanvasApiClient')
const fs = require('fs');
const Banner = require('./banner/BannerOperations')
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const lti = require('ims-lti');
const lti_config = require('../../lti.config.json');
const Logger = require('winston');
const session = require('client-sessions');
var nocache = require('nocache');


app.set('views', __dirname + '/views');
app.use(express.static('dist'));
app.use(nocache());
app.use(session({
    cookieName: 'session',
    secret: lti_config.cookie_secret,
    duration: 120 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
    httpOnly: true,
    secure: true,
    ephemeral: true
}));
var ssl_options = {
    key: fs.readFileSync(lti_config.ssl_key),
    cert: fs.readFileSync(lti_config.ssl_cert),
    requestCert: false
};
var getHost = function (req) {
    var host = '';
    if (req.secure) {
        host += "https://";
    } else {
        host += "http://";
    }
    host += req.headers.host;
    return host;
};

/**
 * 
 */
app.post('/lti/launch', bodyParser.urlencoded({
    extended: false
}), async function (req, res) {
    Logger.info('LTI request', {
        lti: req.body
    });

    var provider = new lti.Provider(lti_config.key, lti_config.secret);
    provider.valid_request(req, async function (err, isValid) {
        if (!isValid) {
            Logger.error('Invalid LTI Launch Request', {
                parameters: req.body
            });
            return res.redirect(`/error.html?e=Ooops, something went wrong.`);

        }
        if ((!req.body.roles || req.body.roles.indexOf('Instructor') < 0) && (!req.body.ext_roles || req.body.ext_roles.indexOf('Instructor') < 0)) {
            Logger.error('User does not have Teacher role in the course', {
                parameters: req.body
            });
            return res.redirect('/access_denied.html')

        }
        if (!req.body.custom_canvas_api_domain || !lti_config.canvasDomain.includes(req.body.custom_canvas_api_domain)) {
            Logger.error('This Canvas instance is not authorized.', {
                parameters: req.body
            });
            return res.redirect('/error.html?e=This Canvas instance is not authorized to use this app.')
        }

        try {
            let sections = await getCourseSections(req.body.custom_canvas_course_id);
            let gradable = true;
            for (let i = 0; i < sections.crns.length && gradable; i++) {
                gradable = await checkIfSectionGradable(sections.term, sections.crns[i]);
            }
            if (!gradable) {
                Logger.error('None of the sections are gradable');
                return res.redirect('/non_gradables.html');

            }

            let primary = await checkIfPrimary(req.body.custom_canvas_course_id, req.body.lis_person_sourcedid);

            if (!primary) {

                Logger.error('Canvas teacher is not a primary instructor in Banner.', {
                    parameters: req.body
                });
                return res.redirect('/access_denied.html');
            }
            let gradeSettings = await checkGradeSettings(req.body.custom_canvas_course_id);
            if (!gradeSettings) {
                Logger.error('Issue with grade settings.');
                return res.redirect('/grade_settings_error.html')
            }
        } catch (e) {
            Logger.error('Error on gradable and primary instructor check.', e);
            return res.redirect(`/error.html?e=Ooops, something went wrong.`);
        }

        req.session.lti_params = req.body;
        if (isValid) {
            res.redirect('/index.html');
        }
    })
})

/**
 * Checks if Banner sections is gradable and final grade web control for Part of Term is enabled.
 * @param {String} term in Banner. 
 * @param {String} crn in Banner.
 * @returns true if section is gradable, otherwise false.
 */
async function checkIfSectionGradable(term, crn) {
    Logger.info('Checking if seciton gradable', {
        term,
        crn
    })
    let gradable = await Banner.checkSection(term, crn);
    if (gradable.length > 0 && gradable[0].SSBSECT_GRADABLE_IND === 'Y' && gradable[0].SOBPTRM_FGRD_WEB_UPD_IND === 'Y') {
        Logger.info('Section is gradable', gradable)
        return true;
    } else {
        Logger.info('Seciton is not gradable', gradable);
        return false;
    }
}

/**
 * Verifies grading schema is set in Canvas course.
 * @param {String} canvas_course_id is course id in Canvas. 
 * @returns true if grading schema is set.
 */
async function checkGradeSettings(canvas_course_id) {
    let courseSettings = await CanvasApiClient.getCourse(canvas_course_id);
    Logger.info('Course settings', {
        canvas_course_id,
        courseSettings
    });
    if (courseSettings.grading_standard_enabled !== true) {
        Logger.info('Grading scheme is not set,', {
            canvas_course_id
        });
        return false;
    } else {
        return true;
    }
}

/**
 * Verifies Canvas teacher using the app is a primary instructor in Banner
 * @param {String} canvas_course_id is canvas course id.
 * @param {String} cNumber is spriden id in banner.
 * @returns true if Canvas teach is primary instructor in Banner. Otherwise, false.
 */
async function checkIfPrimary(canvas_course_id, cNumber) {
    let sections = await CanvasApiClient.getSections(canvas_course_id);
    let crns = [];
    let terms = [];
    sections.forEach(section => {
        let parsed_sis = parseCanvasSis(section.sis_section_id);
        if (!crns.includes(parsed_sis[0])) {
            crns.push(parsed_sis[0]);
        }
        if (!terms.includes(parsed_sis[1])) {
            terms.push(parsed_sis[1]);
        }
    });
    if (terms.length !== 1) {
        throw new Error('There should be only one term!.');
    }
    let primary_crns = await Banner.checkIfPrimary(terms[0], cNumber);
    Logger.info('Primary instructor check', {
        cNumber: cNumber,
        canvas_crns: crns,
        banner_crns: primary_crns
    })
    for (let i = 0; i < crns.length; i++) {
        let found = primary_crns.find(primary_crn => primary_crn.SIRASGN_CRN === crns[i]);
        if (found) return true;
    }
    return false;
}

/**
 * Returns map of enrollment grade information based on spriden id.
 * @param {String} term in Banner. 
 * @param {String} crns in Banner.
 * @param {Boolean} web if set to true (default), removes Banner pidm from the map. 
 */
async function getBannerGrades(term, crns, web = true) {
    let bannerGrades = []
    for (let i = 0; i < crns.length; i++) {
        let grades = await Banner.getSectionGrades(term, crns[i], lti_config.reg_codes);
        bannerGrades = bannerGrades.concat(grades);
    }
    let bannerGradesMap = bannerGrades.reduce((map, obj) => {
        map[obj.SPRIDEN_ID] = {
            grade: obj.SFRSTCR_GRDE_CODE,
            mode: obj.SFRSTCR_GMOD_CODE,
            level: obj.SFRSTCR_LEVL_CODE,
            pidm: obj.SFRSTCR_PIDM,
            crn: obj.SFRSTCR_CRN,
            grade_date: obj.SFRSTCR_GRDE_DATE
        };
        if (!web) {
            map[obj.SPRIDEN_ID].pidm = obj.SFRSTCR_PIDM;
        }
        return map;
    }, {})
    return bannerGradesMap;
}


async function getCourseSections(canvas_course_id) {
    if (!canvas_course_id) {
        canvas_course_id = req.session.lti_params.custom_canvas_course_id;
    }
    let enrollments = await CanvasApiClient.getCourseEnrollments(canvas_course_id);
    let sections = await CanvasApiClient.getSections(canvas_course_id);
    let crns = [];
    let terms = [];
    sections.forEach(section => {
        let parsed_sis = parseCanvasSis(section.sis_section_id);
        if (!crns.includes(parsed_sis[0])) {
            crns.push(parsed_sis[0]);
        }
        if (!terms.includes(parsed_sis[1])) {
            terms.push(parsed_sis[1]);
        }
    });
    if (terms.length !== 1) {
        throw new Error('There should be only one term!.')
    }
    return {
        crns,
        term: terms[0]
    }
}


app.get('/api/get_grades', bodyParser.urlencoded({
    extended: false
}), async function (req, res) {
    try {
        Logger.info('Session Info', {
            session_info: req.session
        })
        if (!req.session.lti_params) {

            Logger.error('Browser ookie issue encountered.');
            return res.send({
                success: false,
                messages: [`Submit Grades failed to load because this browser does not accept 3rd party cookies. You can change browser settings to allow them or 
                use a different browser.`]
            })
        }
        let canvas_course_id = req.session.lti_params.custom_canvas_course_id;
        let enrollments = await CanvasApiClient.getCourseEnrollments(canvas_course_id);
        let sections = await CanvasApiClient.getSections(canvas_course_id);
        let crns = [];
        let terms = [];
        sections.forEach(section => {
            let parsed_sis = parseCanvasSis(section.sis_section_id);
            if (!crns.includes(parsed_sis[0])) {
                crns.push(parsed_sis[0]);
            }
            if (!terms.includes(parsed_sis[1])) {
                terms.push(parsed_sis[1]);
            }
        });
        if (terms.length !== 1) {
            throw new Error('There should be only one term!.')
        }
        let bannerGrades = await getBannerGrades(terms[0], crns);
        let gradesRolled = true;
        for (let i = 0; i < enrollments.length; i++) {
            let e = enrollments[i];
            if (e.grades && e.grades.final_grade && e.user.sis_user_id) {
                let b = bannerGrades[e.user.sis_user_id];
                if (b) {
                    e.grades.sub_grade = subGrade(e.grades.final_grade, b.mode, b.level, 'web', e.user.sis_user_id, b.crn);
                    if (!b.grade_date) {
                        gradesRolled = false;
                    }
                }
            }
        }
        res.send({
            canvas_course_id,
            success: true,
            enrollments,
            sections,
            crns,
            bannerGrades,
            term: terms[0],
            gradesRolled: gradesRolled

        })
    } catch (e) {
        Logger.error(e);
        res.send({
            success: false,
            messages: [`Ooops, something went wrong.`]
        })
    }
});

app.get('/lti/config/enabled', function (req, res) {
    res.set('Content-Type', 'application/rss+xml');
    res.render('lti_config_enabled.ejs', {
        "host": getHost(req)
    });
});


function subGrade(grade, mode, level, pidm, cNumber, crn) {
    Logger.info(`Grade Sub Op ${pidm}`, {
        grade,
        mode,
        level,
        pidm,
        crn,
        cNumber
    })
    if (!lti_config.grade_table[level] || !lti_config.grade_table[level][mode] || !lti_config.grade_table[level][mode][grade]) {
        Logger.error(`Grade Sub Failed ${pidm}`, {
            grade,
            mode,
            level,
            pidm,
            crn,
            cNumber
        });
        return null;
    } else {
        return lti_config.grade_table[level][mode][grade];
    }
}



app.post('/api/submit_grades', bodyParser.json(), async function (req, res) {
    Logger.info("Received submit grade request from course", {
        course_id: req.body.canvas_course_id
    });
    try {
        if (!req.session || !req.session.lti_params || !req.session.lti_params.custom_canvas_course_id) {
            return res.send(JSON.stringify({
                success: false,
                messages: [`Session expired. Refresh this page to continue. If this error occurs even after refresh, you might be using an incompatible browser. 
                Try updating the browser or submitting grades from a different browser.`]
            }));
        }
        if (req.body.canvas_course_id === req.session.lti_params.custom_canvas_course_id) {
            let canvas_course_id = req.session.lti_params.custom_canvas_course_id;
            let enrollments = await CanvasApiClient.getCourseEnrollments(canvas_course_id);
            let sections = await CanvasApiClient.getSections(canvas_course_id);
            let crns = [];
            let terms = [];
            sections.forEach(section => {
                let parsed_sis = parseCanvasSis(section.sis_section_id);
                if (!crns.includes(parsed_sis[0])) {
                    crns.push(parsed_sis[0]);
                }
                if (!terms.includes(parsed_sis[1])) {
                    terms.push(parsed_sis[1]);
                }
            });
            if (terms.length !== 1) {
                throw new Error('There should be only one term!.')
            }
            let bannerGrades = await getBannerGrades(terms[0], crns, false);
            let messages = [];
            for (let i = 0; i < enrollments.length; i++) {
                let studentCnumber = enrollments[i].user.sis_user_id;
                let teacherCnumber = req.session.lti_params.lis_person_sourcedid;
                if (bannerGrades.hasOwnProperty(studentCnumber) && !bannerGrades[studentCnumber].grade) {
                    let parsed_sis = parseCanvasSis(enrollments[i].sis_section_id);
                    let crn = parsed_sis[0];
                    let g = subGrade(enrollments[i].grades.final_grade, bannerGrades[studentCnumber].mode,
                        bannerGrades[studentCnumber].level, studentCnumber, bannerGrades[studentCnumber].crn);
                    Logger.info(`Syncing grade`, {
                        'GradeAfterSub': g,
                        CanvaData: enrollments[i],
                        BannerData: bannerGrades[studentCnumber]
                    })
                    if (g) {
                        try {
                            await syncGrades(terms[0], crn, studentCnumber, teacherCnumber,
                                g);
                        } catch (e) {


                            Logger.error(`Error Syncing grade`, {
                                'error': e,
                                'GradeAfterSub': g,
                                CanvasData: enrollments[i],
                                BannerData: bannerGrades[studentCnumber]
                            })

                        }
                    } else {
                        Logger.error(`Not syncing grades due to bad grade`, {
                            'GradeAfterSub': g,
                            CanvasData: enrollments[i],
                            BannerData: bannerGrades[studentCnumber]
                        })
                    }
                }
            }
            res.send(JSON.stringify({
                success: true
            }));
        } else {
            res.send(JSON.stringify({
                success: false,
                messages: ['Grade submission is only allowed for one course at a time. Try reloading the page and try again']
            }));
        }

    } catch (e) {
        Logger.error(e);
        res.send(JSON.stringify({
            success: false,
            messages: [`Ooops, something went wrong.`]
        }))
    }

})


var server = https.createServer(ssl_options, app).listen(lti_config.port, function () {
    Logger.info(`https server started at port`, {
        port: lti_config.port
    });
})

let term_regex = new RegExp(lti_config.section_term_expr);
let crn_regex = new RegExp(lti_config.section_crn_expr);

function parseCanvasSis(sis_id) {
    Logger.info('Parsing sis', {
        sis_id
    });
    let term = sis_id.match(term_regex)[0];
    let crn = sis_id.match(crn_regex)[0];
    Logger.info('CRN Term', {crn, term});
    return [crn, term];
}

async function syncGrades(term, crn, studentCnumber, teacherCnumber, grade) {
    Logger.info('Ready to sync grade', {
        term,
        crn,
        studentCnumber,
        teacherCnumber,
        grade
    })
    let studentPidm = await Banner.getUserPidm(studentCnumber);
    let teacherPidm = await Banner.getUserPidm(teacherCnumber);
    await Banner.syncGrade(term, crn, studentPidm[0].SPRIDEN_PIDM, teacherPidm[0].SPRIDEN_PIDM, grade);
    Logger.info('Syn completed', {
        term,
        crn,
        studentCnumber,
        teacherCnumber,
        studentPidm: studentPidm[0].SPRIDEN_PIDM,
        teacherPidm: teacherPidm[0].SPRIDEN_PIDM,
        grade
    });
}
