import React, { useState, useEffect } from "react";
import { compose } from "recompose";
import styled from "styled-components";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Toast from "react-bootstrap/Toast";

import { withAuthorization } from "../components/Session";
import { withFirebase } from "../components/Firebase";
import AdminLayout from "./AdminLayout";
import Loader from "./Loader";

/*
  Types of questions:
  short/long text, number, checkbox, file upload
  Things that wont change semester to semester: name, email, major, year, resume

  Things that may change: taken 112/330 checkbox, short paragraph questions
  Allow addition/removal of checkboxes and textareas for now, as well as reordering them

  For unambiguity, rename all this application stuff to applicationForm

  add a reset db button in general settings that saves a copy of the inquisitor db then deletes it so it can be re-init (make sure theres ample warnings)
  for future perhaps add ability for select/dropdown questions

  this file is a big boi, needs to shrink
*/

// assumes this is run before the coming recruitment season
const estimateSemester = () => {
  const month = new Date().getMonth();
  let semester;

  if (month >= 10) {
    // november or december
    semester = `Spring-${new Date().getFullYear() + 1}`;
  } else if (month >= 2) {
    // march or later
    semester = `Fall-${new Date().getFullYear()}`;
  } else {
    // january or february
    semester = `Spring-${new Date().getFullYear()}`;
  }

  return semester;
};

const DEFAULT_APPLICATION_FORM_CONFIG = {
  semester: estimateSemester(),
  questions: [
    {
      id: 1,
      order: 1,
      name: "Full Name",
      type: "text",
      required: true,
      default: true,
    },
    {
      id: 2,
      order: 2,
      name: "Email",
      type: "email",
      required: true,
      default: true,
    },
    {
      id: 3,
      order: 3,
      name: "Major",
      type: "text",
      required: true,
      default: true,
    },
    {
      id: 4,
      order: 4,
      name: "Minor",
      type: "text",
      required: false,
      default: true,
    },
    {
      id: 5,
      order: 5,
      name: "Class Year",
      type: "number",
      required: true,
      default: true,
    },
    {
      id: 6,
      order: 6,
      name: "Resume",
      type: "file",
      required: true,
      default: true,
    },
  ],
};

const UnderlinedLabel = styled(Form.Label)`
  border-bottom: 2px solid;
  border-color: ${(props) => props.theme.palette.mainBrand};
`;

const RequiredAsterisk = styled.span`
  color: red;

  &:after {
    content: "*";
  }
`;

const ConfigureApplicationForm = ({ firebase }) => {
  const [applicationFormConfig, setApplicationFormConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  useEffect(() => {
    const loadApplicationFormConfig = async () => {
      const doc = await firebase.applicationFormConfig().get();

      if (!doc.exists) {
        await firebase
          .applicationFormConfig()
          .set(DEFAULT_APPLICATION_FORM_CONFIG);
        setApplicationFormConfig(DEFAULT_APPLICATION_FORM_CONFIG);
      } else {
        setApplicationFormConfig(doc.data());
      }

      setLoading(false);
    };
    if (firebase) loadApplicationFormConfig();
  }, [firebase]);

  if (loading) return <Loader />;

  const saveApplicationFormConfig = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (form.checkValidity() === false) {
      event.stopPropagation();
    } else {
      const semester = form.querySelector("#semester").value;
      const year = form.querySelector("#year").value;
      const newApplicationFormConfig = {
        ...applicationFormConfig,
        semester: `${semester}-${year}`,
      };

      await firebase.applicationFormConfig().set(newApplicationFormConfig);
      setApplicationFormConfig(newApplicationFormConfig);
      setShowToast(true);
    }
  };

  const addNewQuestion = (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (form.checkValidity() === false) {
      event.stopPropagation();
    } else {
      const questionsCopy = [...applicationFormConfig.questions];
      const nextId =
        Math.max(...applicationFormConfig.questions.map((q) => q.id)) + 1;
      const nextOrder =
        Math.max(...applicationFormConfig.questions.map((q) => q.order)) + 1;

      questionsCopy.push({
        id: nextId,
        order: nextOrder,
        name: form.querySelector("#newQuestionName").value,
        type: form.querySelector("#newQuestionType").value,
        required: form.querySelector("#newQuestionRequired").checked,
      });

      setApplicationFormConfig({
        ...applicationFormConfig,
        questions: questionsCopy,
      });
      closeModal();
    }
  };

  const updateQuestionOrder = (questionId, order) => {
    // heres where we need redux
    const questions = [...applicationFormConfig.questions]; // get temp array
    const questionIndex = questions.findIndex(
      (question) => question.id === questionId
    ); // find question
    questions[questionIndex].order = -1; // set order to -1 temporarily

    // shift question in slot and other ones down
    questions.forEach((question) => {
      if (question.order >= order) question.order += 1;
    });

    questions[questionIndex].order = order; // set order what it should be

    setApplicationFormConfig({
      ...applicationFormConfig,
      questions: questions,
    });
  };

  const QuestionSlot = ({ isdefault, order, children }) => {
    const [{ isOver }, drop] = useDrop({
      accept: "question",
      drop: (item) => updateQuestionOrder(item.id, order),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    });

    if (isdefault) return <div style={{ maxWidth: 300 }}>{children}</div>;

    return (
      <div
        ref={drop}
        style={{
          borderTop: `${isOver ? "2px solid red" : "none"}`,
          maxWidth: 300,
        }}
      >
        {children}
      </div>
    );
  };

  const QuestionWrapper = ({ questionId, isdefault, children }) => {
    const [, dragRef] = useDrag({
      item: {
        type: "question",
        id: questionId,
      },
    });

    const props = {};
    if (!isdefault) props.ref = dragRef;

    return (
      <Form.Row {...props}>
        <Form.Group controlId={questionId}>{children}</Form.Group>
      </Form.Row>
    );
  };

  const renderQuestion = (question, disabled = false) => {
    const renderLabel = (question) => {
      if (question.default) {
        return (
          <UnderlinedLabel>
            {question.name} {question.required && <RequiredAsterisk />}
          </UnderlinedLabel>
        );
      } else {
        return (
          <Form.Label>
            {question.name} {question.required && <RequiredAsterisk />}
          </Form.Label>
        );
      }
    };

    let questionComponent;
    if (question.type === "textarea") {
      questionComponent = (
        <Form.Control
          required={question.required}
          as="textarea"
          rows="3"
          disabled={disabled}
        />
      );
    } else {
      questionComponent = (
        <Form.Control
          required={question.required}
          type={question.type}
          disabled={disabled}
        />
      );
    }

    return (
      <QuestionSlot
        key={question.id}
        isdefault={question.default}
        order={question.order}
      >
        <QuestionWrapper questionId={question.id} isdefault={question.default}>
          {renderLabel(question)}
          {questionComponent}
        </QuestionWrapper>
      </QuestionSlot>
    );
  };

  const year = new Date().getFullYear();
  return (
    <AdminLayout>
      <h1>Configure Application</h1>

      <Form onSubmit={saveApplicationFormConfig}>
        <Row>
          <Col md="6">
            <p>
              This sets the semester-year for the coming recruitment season.
              Make sure to set this before starting the season.
            </p>
            <Form.Row>
              <Form.Group controlId="semester">
                <Form.Label>Semester</Form.Label>
                <Form.Control
                  as="select"
                  defaultValue={applicationFormConfig.semester.split("-")[0]}
                >
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                </Form.Control>
              </Form.Group>
            </Form.Row>
            <Form.Row>
              <Form.Group controlId="year">
                <Form.Label>Year</Form.Label>
                <Form.Control
                  as="select"
                  defaultValue={applicationFormConfig.semester.split("-")[1]}
                >
                  <option value={year}>{year}</option>
                  <option value={year + 1}>{year + 1}</option>
                </Form.Control>
              </Form.Group>
            </Form.Row>
          </Col>
          <Col md="6">
            <p>
              These are the questions that applicants will see (in this order).
              Default questions are underlined in red and can't be re-ordered.
              Required questions will have an asterisk.
            </p>
            <DndProvider backend={HTML5Backend} id="questions">
              {applicationFormConfig.questions
                .sort((a, b) => (a.order > b.order ? 1 : -1))
                .map((question) => renderQuestion(question, true))}
            </DndProvider>

            <Button onClick={openModal}>Add Question</Button>
          </Col>
        </Row>
        <hr />
        <div
          style={{
            display: "flex",
          }}
        >
          <Button type="submit" disabled={showToast}>
            Save Config
          </Button>
          <Toast
            onClose={() => setShowToast(false)}
            show={showToast}
            delay={3000}
            autohide
            style={{
              width: "fit-content",
              marginLeft: 25,
            }}
          >
            <Toast.Header>
              <strong className="mr-auto">Config Saved!</strong>
            </Toast.Header>
          </Toast>
        </div>
      </Form>

      <Modal show={modalOpen} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Question</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={addNewQuestion} id="newQuestionForm">
            <Form.Row>
              <Form.Group as={Col} md="4" controlId="newQuestionName">
                <Form.Label>Name</Form.Label>
                <Form.Control required type="text" placeholder="Enter Name" />
              </Form.Group>

              <Form.Group as={Col} md="4" controlId="newQuestionType">
                <Form.Label>Type</Form.Label>
                <Form.Control as="select" required>
                  <option value="">-- Select Type --</option>
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="email">email</option>
                  <option value="number">number</option>
                  <option value="checkbox">checkbox</option>
                  <option value="file">file</option>
                </Form.Control>
              </Form.Group>

              <Form.Group as={Col} md="4" controlId="newQuestionRequired">
                <Form.Label>Required?</Form.Label>
                <Form.Control type="checkbox" />
              </Form.Group>
            </Form.Row>

            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </AdminLayout>
  );
};

const condition = (authUser) => !!authUser;
export default compose(
  withAuthorization(condition),
  withFirebase
)(ConfigureApplicationForm);
