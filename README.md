
# Canvas Banner Grade Sync
Canvas Banner Grade Sync is a LTI app that can be used to save final grades from Canvas LMS to Banner ERP. 

## Features
* Final grades are synced for both regular and cross-listed courses.
* Grades are validated and automatially substituted for non-credit enrollments.
* Access is limited to Banner primary instructor, specific Canvas instance and only when final grade web entry web control is enabled in Banner for the Part of Term.
* [Accessible UI with pre-built Canvas theme.](screenshots.md) 


## Requirements
* Canvas courses should have valid grading schema set.
* Instructors must grade and unmute all assignemnts.
* SIS IDs for Canvas sections include information about Banner term and CRN.
* User SID ID is set to Banner SPRIDEN ID.
* App can be hosted on a server with these confiugrations. Linux is recomended to host the app and instructions largely follow Linux convensions.
    * Accepts secure internet connections using a domain name and a valid SSL/TLS certificate.
    * Access to Banner database for SQL queries if database is behind firewall including credentials with following grants
        * Read grants on tables sirasgn, spriden, sfrstcr, ssbsect and sobptrm 
        * Execution grant on baninst1.sp_grading.p_post_grade
    * Access token from a Canvas admin profile with account permissions to read grades, users, sections and courses.


## Installation
These instructions will get the app up and running on a test server. See deployment for additional notes on how to deploy the project on a live system.
* Install Node.js (8 or later) from nodejs.org.
* Install node-oracledb using the [Quick Start Node-oracledb](https://oracle.github.io/node-oracledb/INSTALL.html#quickstart)
* Download and extract code 
``` 
wget https://github.com/cccd-is/canvas-banner-grades/archive/v1.0.0.tar.gz
tar xvf v1.0.0.tar.gz
```
or
```
git clone https://github.com/cccd-is/canvas-banner-grades.git 

```

* **cd** into **canvas-banner-grades-1.0.0** directory.
* [Configure Settings](#configure-settings) 
* Install dependencies
```
npm install  
```
* Fix for SameSite=None cookie attribue introduced in [Chrome 80 Feb 2020]. Published libraries dont support it yet so this temporary workaround is needed. 
``` 
cd node_modules/client-sessions
npm install cookies@0.8.0
cd ../..
```
* Buid App
``` 
npm run build 
```
* Start the app
``` 
npm run start 
```

At this point, if there are no errors, LTI app is ready to be [installed in Canvas and tested.](#canvas-installation)

## Configure Settings
Configuration settings are set in [**lti_config.json**](lti.config.json) in root directory. [Example config file lti.config.json.example](lti.config.json.example) can be renamed with appropriate values. Key values must be set to correct type. Using system environment variables like process.env.port is recomended.
* **port** should always be set to 443 unless it is a test environment and 443 is not available. (*string*) 
* **Key**  is used to configure LTI and should be unique for test and dev environment.(*string*)
* **Secret** is used to configure LTI. It should be a random string of a reasonable length to prevent it from being easily guessed or recreated.  (*string*)
* **canvasURL** should be a valid Canvas instance URL postfixed by /api/v1/. (Example : https://yourcollege.test.instructure.com/api/v1/) (*string*)
* **canvasAccessToken** is a Canvas access token form an Admin profile with rights to read grades, users, courses and sections. (*string*)
* **canvasDomain** should be the list of all Canvas instance URLS in a list []. These are listed in Canvas under Admin->Settings->Canvas Cloud Information (Example :["yourdistrict.test.instructure.com" "yourcollege.test.instructure.com"]) (*list*)
* **banner**  specifies Banner connection information. (*object*)
    * **user**  Database username (*string*)
    * **password** Database password (*string*)
    * **connectString** Database connection string (*string*)
    * **queueTimeout**  default is 60000. See https://oracle.github.io/node-oracledb/doc/api.html#propdbqueuetimeout
    * **poolAlias** Example : banner. See https://oracle.github.io/node-oracledb/doc/api.html#-33117-poolalias
* **ssl_key** is the path to the SSL/TLS cert key in PEM format. (*string*)
* **ssl_cert** is the path to the SSL/TLS cert file in PEM format. (*string*)
* **cookie_secret** It should be a random string of a reasonable length to prevent it from being easily guessed or recreated. (*string*)
* **grade_table** lists all valid grades and any substitutes. Grades are organized by levels and grade modes as defined in a Banner instance. Example below lists 'B' mode for level NC and 'B' and 'S' modes for level 'OC'. Any grade not listed will be invalidated.. Grade value should be changed to the subsituted value where relevent (for example P or NP for non-credit courses). Levels, modes and corresponding grades are listed in Banner forms shagrde and shagrds.

```
  "grade_table": {
        "NC": {
            "B": {
                "A": "P",
                "B": "P",
                "C": "P",
                "D": "NP",
                "F": "NP"
            }
        },
        "OC": {
            "B": {
                "A": "P",
                "B": "P",
                "C": "P",
                "D": "NP",
                "F": "NP"

            },
            "S": {
                "A": "A",
                "B": "B",
                "C": "C",
                "D": "D",
                "F": "F"
            }
        }
}
```
* **section_term_expr** is a regular experession to extract Banner term from Canvas section SIS ID. For example, expression below extracts term 201831 from SIS ID **24875.201831** (string)
```
"\\d{6}$"
```
* **section_crn_expr** is a regular experession to extract Banner CRN from Canvas section SIS ID. For example, expression below extracts CRN 24875 from SIS ID **24875.201831** (string)
```
"^\\d{5}"
```
*  **reg_codes** is list of valid gradable registration codes in a Banner instance. (array)
```
["R1", "R2", "R3"]
```

## Canvas Installation
Add app in Settings->Apps with information below
*  Select **By URL** for **Configuration Type**.
* Set name to  '**Canvas Banner Grade Sync**'.
* Enter **Key** and **Secert** as configured in **lti_config.json**.
* Enter **server domain** where app is hosted postfixed with "/lti/config/enabled". (Example : "https://yourappserver.com/lti/config/enabled")

Now app can be tested in a Canvas course shell. Note that Final grade web control in Banner for Part of Term of a course must be checked in order to pass validation and successfully launch the app. 

## UI customizations
Any UI changes can be made in src/client/App.js and will require re-building the app.
```
 npm run build 
 
 ```


## Deployment
A process manager like PM2 can be used for live deployment
```
npm install pm2 -g
pm2 start src/server/index.js

```

## Issues and Bugs
Please consult [F.A.Q.](FAQ.md) before submitting any issues or bugs.

## Authors
* [**Atif Chaudhry**](https://github.com/xacx)






