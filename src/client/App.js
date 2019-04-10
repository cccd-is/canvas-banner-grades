import React, {
	Component
} from 'react'
import theme from '@instructure/ui-themes/lib/canvas'
import Heading from '@instructure/ui-elements/lib/components/Heading'
import Table from '@instructure/ui-elements/lib/components/Table'
import Pill from '@instructure/ui-elements/lib/components/Pill'
import List from '@instructure/ui-elements/lib/components/List'
import ListItem from '@instructure/ui-elements/lib/components/List/ListItem'
import Button from '@instructure/ui-buttons/lib/components/Button'
import Overlay from '@instructure/ui-overlays/lib/components/Overlay'
import Mask from '@instructure/ui-overlays/lib/components/Mask'
import Spinner from '@instructure/ui-elements/lib/components/Spinner'
import Modal from '@instructure/ui-overlays/lib/components/Modal'
import ModalHeader from '@instructure/ui-overlays/lib/components/Modal/ModalHeader'
import ModalFooter from '@instructure/ui-overlays/lib/components/Modal/ModalFooter'
require('es6-promise').polyfill();
require('isomorphic-fetch');
theme.use()
class App extends Component {
	state = {
		grade_data: {
			gradesRolled: true,
			canvas_course_id: undefined,
			enrollments: [],
			sections: [{
				name: 'loading...'
			}],
			bannerGrades: {},
			crns: ['loading...'],
			term: 'loading...'
		},
		syncing: true,
		openWaitSyncing: false,
		openConfirm: false,
	};
	componentDidMount() {
		fetch('/api/get_grades', {
				credentials: 'include',
				mode: 'cors'
			})
			.then(function (res) {
				return res.json()
			})
			.then(grade_data => {
				if (grade_data.success) {
					this.setState({
						grade_data: grade_data,
						syncing: false
					});
				} else {
					location.href = '/error.html?e=' + grade_data.messages.join(' , ')
				}
			})
			.catch(function (e) {
				console.log(e)
			});
	}
	getCrn(sis_user_id) {
		let bannerGrade = this.state.grade_data.bannerGrades[sis_user_id];
		if (bannerGrade && bannerGrade.crn) {
			return bannerGrade.crn;
		} else {
			return '';
		}
	}

	getSubGrade(sis_user_id) {
		if (this.bannerGrades[sis_user_id] && this.bannerGrades[sis_user_id].sub_grade) {
			return this.bannerGrades[sis_user_id].sub_grade;
		} else {
			return '';
		}
	}


	onSync(e) {
		e.preventDefault();
		this.setState({
			openConfirm: true
		}, () => {
		});
	}
	onClose(e) {
		e.preventDefault();
		this.setState({
			openConfirm: false
		})
	}
	onConfirm(e) {
		e.preventDefault();
		this.setState({
			openConfirm: false,
			syncing: true,
			openWaitSyncing: true
		});
		fetch('/api/submit_grades', {
				method: 'post',
				headers: {
					"Content-Type": "application/json; charset=utf-8"
				},
				body: JSON.stringify({
					canvas_course_id: this.state.grade_data.canvas_course_id
				})
			}).then(res => res.json())
			.then(response => {
				if (response.success) {
					location.href = "/index.html"
				} else {
					location.href = '/error.html?e=' + response.messages.join(' , ')
				}
			}).catch(e => {
				console.log(e);
			})
	};

	getGrade(sis_user_id) {
		return ((this.state.grade_data.bannerGrades[sis_user_id] && this.state.grade_data.bannerGrades[sis_user_id].grade) ? this.state.grade_data.bannerGrades[sis_user_id].grade : '');
	}
	render() {
		return (
      <div className="App">
        <div>
          {" "}
          <Overlay
            open={this.state.openWaitSyncing}
            transition="fade"
            label="Overlay Example"
            shouldReturnFocus
            shouldContainFocus
          >
            <Mask>
              <Spinner title="Loading" size="large" margin="0 0 0 medium" />
            </Mask>{" "}
          </Overlay>
        </div>
        <Modal
          as="form"
          open={this.state.openConfirm}
          onSubmit={this.onConfirm.bind(this)}
          onDismiss={() => {
            this.setState({ openConfirm: false });
          }}
          label="Confirm Grade Submission"
          shouldCloseOnDocumentClick
        >
          <ModalHeader>
            <Heading>
              Please confirm that all final grades have been reviewed and
              are ready to be submitted.
            </Heading>
          </ModalHeader>

          <ModalFooter>
            <center>
              <Button onClick={this.onClose.bind(this)}>Cancel</Button>{" "}
              {"                 "}
              <Button variant="primary" type="submit">
                Submit Final Grades
              </Button>
            </center>
          </ModalFooter>
        </Modal>
        <Modal
          open={this.state.openWaitSyncing}
          label="Grade Submission in Progress"
          shouldCloseOnDocumentClick
        >
          <ModalHeader>
            {/* this.renderCloseButton() */}
            <Heading>
              Please wait while grades are being submitted...
            </Heading>
          </ModalHeader>
        </Modal>
        <center>
          <Heading level="h2" as="h2">
            Submit Final Grades{" "}
          </Heading>
        </center>
        <center>
          <Heading level="h4" as="h4">
            {" "}
            You can submit your final letter grades through Canvas. Here is
            how:{" "}
          </Heading>{" "}
        </center>
        <center>
          {this.state.grade_data.term == "loading..." && (
            <Spinner title="Loading" size="large" margin="0 0 0 medium" />
          )}
        </center>
        <br />
        <br />
        <List margin="0 0 small" delimiter="solid">
          <ListItem>
            {" "}
            Grades below can be submitted for the following section(s) for
            term{" "}
            <b>
              {this.state.grade_data.term} :{" "}
              {this.state.grade_data.sections.map((section, i) => {
                return <span>{section.name} </span>;
              })}
            </b>{" "}
          </ListItem>
          <ListItem>
            {" "}
            Please ensure all Canvas grades are accurate. After reviewing
            grades below, please click 'Submit Grades' at the bottom of the
            page.
          </ListItem>
          <ListItem>
            {" "}
            Make sure that all assignments have been graded before using
            this tool.{" "}
          </ListItem>
          <ListItem>
            {" "}
            Banner will accept the following grades. Invalid grades will not
            be submitted to Banner for that student.
            <Table>
              <thead>
                <tr>
                  <th scope="col">Course Type</th>
                  <th scope="col">Grade Option</th>
                  <th scope="col">Valid Grades in Canvas</th>
                  <th scope="col">Substitutions</th>
                </tr>
              </thead>
              <tbody>
                <tr scope="row">
                  <td>Credit </td> <td>Letter Grade</td>{" "}
                  <td>A, B, C, D, or F</td>
                  <td>None</td>{" "}
                </tr>
                <tr scope="row">
                  {" "}
                  <td>Credit </td> <td>Pass/No Pass</td>{" "}
                  <td>A, B, C, D, F, P or NP</td>
                  <td>
                    {" "}
                    A, B and C are substituted with P.
                    <br /> D and F are substituted with NP.{" "}
                  </td>
                </tr>

                <tr scope="row">
                  {" "}
                  <td>Noncredit </td> <td>Pass/No Pass</td>{" "}
                  <td>A, B, C, D, F, P, NP or SP</td>
                  <td>
                    {" "}
                    A, B and C are substituted with P. <br /> D and F are
                    substituted with NP.
                  </td>
                </tr>
              </tbody>
            </Table>
          </ListItem>
          <ListItem>
            If a grade is present in the Current Banner Grade column you
            must make any changes to that particular grade in Banner.
          </ListItem>
          <ListItem>
            After submitting grades, you must <b>ALSO</b> enter your last
            date of attendance in Banner for grades of F, NP, I, or W.{" "}
          </ListItem>
          <ListItem>
            Once you submit grades, the screen will confirm your grades were
            received with the following icons:
            <Pill variant="danger" text="GP" margin="x-small" /> GP (Grade
            Present)
          </ListItem>
          <ListItem>
            <Pill variant="danger" text="EM" margin="x-small" /> EM
            (Enrollment Missing) indicates Canvas enrollment is missing in
            Banner or it is an audit.
          </ListItem>
        </List>
        <Table>
          <thead>
            <tr>
              <th scope="col">Student Name</th>
              <th scope="col">ID#</th>
              <th scope="col"> Banner CRN </th>
              <th scope="col">Canvas Grade</th>
              <th scope="col">Grade to be Submitted</th>
              <th scope="col">Current Banner Grade (if set)</th>
            </tr>
          </thead>
          <tbody>
            {this.state.grade_data.enrollments
              .filter(e => e.user.name != "Test Student")
              .map((e, i) => {
                return (
                  <tr key={i}>
                    <th scope="row">
                      {" "}
                      {e.user.sortable_name}
                      {this.getGrade(e.user.sis_user_id) && (
                        <Pill variant="danger" text="GP" margin="x-small" />
                      )}
                      {!this.state.grade_data.bannerGrades.hasOwnProperty(
                        e.user.sis_user_id
                      ) && (
                        <Pill variant="danger" text="EM" margin="x-small" />
                      )}
                    </th>
                    <td>{e.user.sis_user_id} </td>
                    <td>{this.getCrn(e.user.sis_user_id)} </td>
                    <td>
                      {e.grades.final_grade}{" "}
                      {e.grades.final_grade && (
                        <span> ({e.grades.final_score}%)</span>
                      )}
                    </td>
                    <td> {e.grades.sub_grade} </td>
                    <td>{this.getGrade(e.user.sis_user_id)}</td>
                  </tr>
                );
              })}
          </tbody>
        </Table>
        <br />
        <br />
        <center>
          {" "}
          {this.state.grade_data.gradesRolled && !this.state.syncing && (
            <span>
              Grade submission is disabled if the course was taught in the
              past or grades are not set.
            </span>
          )}
        </center>
        <form onSubmit={this.onSync.bind(this)}>
          <center>
            {" "}
            <Button
              type="submit"
              disabled={
                this.state.syncing || this.state.grade_data.gradesRolled
              }
              variant="primary"
              margin="0 x-small 0 0"
            >
              Submit Grades
            </Button>{" "}
          </center>
        </form>
      </div>
    );
	}
}
export default App
