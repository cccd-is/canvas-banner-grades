'use strict';
const HttpLinkHeader = require('http-link-header');
const lti_config = require('../../lti.config.json');
const Logger = require('winston');
let Request = require('request-promise');
Logger.level = 'debug';

// Configure request-debug to instrument HTTP traffic
require('request-debug')(Request, function (type, data) {
    if (type === 'request') {
        Logger.info(`Dispatching ${data.method} request to ${data.uri}`, {
            debugId: data.debugId
        });
    } else if (type === 'response') {
        Logger.info(`Received response`, {
            uri: data.uri,
            debugId: data.debugId,
            statusCode: data.statusCode,
        });
    }
});

/**
 * Provides a high-level wrapper around the Canvas REST API.
 * See also https://api.instructure.com
 * @license BSD-3-Clause
 */
class CanvasApiClient {

    /**
     * Create a new API client instance
     * @param {String} baseUrl Root URL of the Canvas instance
     * @param {String} apiKey Permanent OAuth API key to use for authenticating requests
     */
    constructor(baseUrl, apiKey) {
        // Create the Request HTTP client
        this.client = Request.defaults({
            baseUrl: lti_config.canvasURL,
            headers: {
                Authorization: `Bearer ${lti_config.canvasAccessToken}`
            },
            json: true,
            simple: true,
            time: true,
            timeout: 20000,
            transform: (body, response, resolveWithFullResponse) => {
                // Track Canvas API usage
                Logger.info(`Canvas API usage`, {
                    rateLimitRemain: parseFloat(response.headers['x-rate-limit-remaining']),
                    requestCost: parseFloat(response.headers['x-request-cost'])
                });

                return (resolveWithFullResponse) ? response : body;
            }
        });
    }

    /**
     * Get all Enrollment objects for a Canvas course. By default, the
     * result is limited to only active students in a course.
     * @param {String|Number} id Canvas course ID
     * @returns {Promise} Resolved with an array of Enrollment objects
     */
    async getCourseEnrollments(id, type = ['StudentEnrollment'], state = ['active']) {
        // Execute request using internal pagination helper function
        return await this.requestWithPagination({
            method: 'GET',
            uri: `/courses/${id}/enrollments`,
            useQuerystring: true,
            qs: {
                'per_page': `500`,
                'type[]': type,
                'state[]': state,
                'role[]': 'StudentEnrollment'
            }
        });
    }

    /**
     * Get all student Enrollment objects for an existing Canvas section.
     * @param {String|Number} id Canvas section ID
     * @returns {Promise} Resolved with an array of Enrollment objects
     */
    async getSectionEnrollment(id) {
        // Execute request using internal pagination helper function
        return await this.requestWithPagination({
            method: 'GET',
            uri: `/sections/${id}/enrollments`,
            useQuerystring: true,
            qs: {
                'per_page': `500`,
                'type[]': 'StudentEnrollment'
            }
        });
    }

    async getSectionTeacherEnrollment(id) {
        // Execute request using internal pagination helper function
        return await this.requestWithPagination({
            method: 'GET',
            uri: `/sections/${id}/enrollments`,
            useQuerystring: true,
            qs: {
                'per_page': `500`,
                'type[]': 'TeacherEnrollment'
            }
        });
    }


    async requestWithPagination(requestOpts) {
        let finalResult = [];
        let hasPagesRemaining = false;
        // REM let paginationUrl = null;
        let requestedPageCount = 0;
        let totalPages = 1;

        // Parse page count from request
        if (requestOpts.qs['per_page']) {
            requestedPageCount = parseInt(requestOpts.qs['per_page']);
        } else if (requestOpts.form['per_page']) {
            requestedPageCount = parseInt(requestOpts.form['per_page']);
        }

        // Fetch the initial page
        let pageResponse = await this.client(
            // Enforce sensible defaults so that pagination can function properly
            Object.assign(requestOpts, {
                resolveWithFullResponse: true,
            }));

        // Append internal result array
        finalResult = finalResult.concat(pageResponse.body);
        Logger.info(`Fetched page ${totalPages}, entry count: ${pageResponse.body.length}, page count per request: ${requestedPageCount}`);

        // Parse pagination orders
        let paginationOrders = this.parseCanvasPagination(pageResponse.headers.link);
        hasPagesRemaining = paginationOrders.next !== undefined;

        // Continue fetching additional pages if possible
        while (hasPagesRemaining) {
            Logger.info(`Next page still available`, {
                hasPagesRemaining: hasPagesRemaining,
                orders: paginationOrders
            });
            totalPages++;

            // Fetch next page
            pageResponse = await this.client({
                method: requestOpts.method,
                baseUrl: null,
                uri: paginationOrders.next,
                resolveWithFullResponse: true
            });

            // Append internal result array
            finalResult = finalResult.concat(pageResponse.body);
            Logger.info(`Fetched page ${totalPages}, entry count: ${pageResponse.body.length}, page count per request: ${requestedPageCount}`);

            // Parse pagination orders
            paginationOrders = this.parseCanvasPagination(pageResponse.headers.link);
            hasPagesRemaining = paginationOrders.next !== undefined;
        }
        Logger.info(`Completed fetching pages`);
        return finalResult;
    }

    /**
     * Utility function to parse content from a standard formatted HTTP Link
     * header, and transform the output into a simple key-value object
     * where rel: url.
     * @param {String} linkHeader String content of the Link header from an HTTP request
     * @returns {Object} One or more links mapped to the rel name
     */
    parseCanvasPagination(linkHeader) {
        return HttpLinkHeader
            .parse(linkHeader)
            .refs
            .reduce((result, ref) => {
                result[ref.rel] = ref.uri;
                return result;
            }, {});
    }



    getGradingStandard(canvas_course_id, grading_standard_id) {
        return this.client({
            method: 'GET',
            uri: `/courses/${canvas_course_id}/grading_standards/${grading_standard_id}`,

        })
    }



    getCourse(canvas_course_id) {
        return this.client({
                mehtod: 'GET',
                uri: `/courses/${canvas_course_id}/settings`,
                qs: {
                    //   include: 'all_courses'
                    //     include: 'term'
                }
            })
            .catch(error => {
                if (error.statusCode === 404) {
                    Logger.verbose(`Could not find section ${sis_course_id} in Canvas`);
                    return null;
                }
                return Promise.reject(error);
            });
    }

    getSections(canvas_course_id) {
        return this.client({
            method: 'GET',
            uri: `/courses/${canvas_course_id}/sections/`
        });

    }


    getCoursesByAccountAndTerm(sis_account_id, sis_term_id) {
        return this.client({
            method: 'GET',
            uri: `/accounts/sis_account_id:${sis_account_id}/courses`,
            qs: {
                'per_page': `2000`,
                'state': 'all',
                'enrollment_term_id': `sis_term_id:${sis_term_id}`
            }
        })

    }



    getUserEnrollmentInSection(section_id, user_id) {
        return this.client({
                mehtod: 'GET',
                uri: `/sections/${section_id}/enrollments`,
                qs: {
                    user_id: user_id
                }
            })
            .catch(error => {
                if (error.statusCode === 404) {
                    Logger.verbose(`Could not find section ${section_id} in Canvas`);
                    return null;
                }
                return Promise.reject(error);
            });
    }



}

module.exports = new CanvasApiClient();