import React, { useState, useEffect, useContext } from "react";
import swal from "@sweetalert/with-react";
import { compose } from "recompose";
import cloneDeep from "lodash.clonedeep";
import { Link, navigate } from "gatsby";
import update from "immutability-helper";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

import { isApplicant } from "../../util/conditions";
import {
  AuthUserContext,
  withFirebase,
  withAuthorization,
} from "upe-react-components";

import { Container, RequiredAsterisk } from "../../styles/global";
import Loader from "../Loader";
import Error from "../Error";

const ApplicantView = ({ firebase }) => {
  const [settings, setSettings] = useState({});
  const [application, setApplication] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadedApplication, setLoadedApplication] = useState(false);
  const [loadedSettings, setLoadedSettings] = useState(false);
  const [error, setError] = useState(null);

  const authUser = useContext(AuthUserContext);

  useEffect(() => {
    if (firebase && !!authUser) {
      const settingsUnsub = firebase
        .generalSettings()
        .onSnapshot((docSnapshot) => {
          if (docSnapshot.exists) setSettings(docSnapshot.data());
          else setError("No Settings!");
          setLoadedSettings(true);
        });

      const applicationUnsub = firebase
        .application(authUser.uid)
        .onSnapshot((docSnapshot) => {
          if (docSnapshot.exists) {
            setApplication(docSnapshot.data());
          } else setError("No Application!");
          setLoadedApplication(true);
        });

      return () => {
        settingsUnsub();
        applicationUnsub();
      };
    }
  }, [firebase, authUser]);

  useEffect(() => {
    if (loadedSettings && loadedApplication) setLoading(false);
  }, [loadedApplication, loadedSettings]);

  if (error) return <Error error={error} />;
  if (loading) return <Loader />;

  const confirm = async () => {
    const roles = cloneDeep(authUser.roles);
    delete roles.nonmember;
    if (
      settings.useTwoRoundDeliberations &&
      !authUser.roles.provisionalMember
    ) {
      roles.provisionalMember = true;

      await firebase.user(authUser.uid).update({ roles });
      await firebase
        .application(authUser.uid)
        .update({ "deliberation.confirmed": true });
    } else {
      delete roles.provisionalMember;
      delete roles.applicant;
      roles.upemember = true;

      const gradYear = application.responses.find((r) => r.id === 5).value;

      await firebase.user(authUser.uid).update({ roles, gradYear });
      await firebase.application(authUser.uid).delete();

      // TODO: make this welcome actually pretty
      await swal(
        "You're in!",
        "Welcome to Upsilon Pi Epsilon at Boston University",
        "success"
      );
      navigate("/");
    }
  };

  const submitData = async (formData) => {
    if (formData.file === null) return;

    const data = {
      profileIMG: formData.profileIMG,
      socials: {
        facebook: formData.facebook,
        github: formData.github,
        linkedin: formData.linkedin,
        twitter: formData.twitter,
      },
    };

    // TODO: refactor along with image url change (keep all user data in storage/userData/UID/)
    await firebase
      .uploadProfile("Provisional", formData.profileIMG)
      .put(formData.file)
      .catch((error) => {
        setError(error);
      });

    await firebase
      .user(authUser.uid)
      .update(data)
      .catch((error) => {
        setError(error);
      });

    await swal("All set!", "We got your info!", "success");
    navigate("/");
  };

  // Hasn't applied yet
  if (!authUser.roles.applicant)
    return (
      <Container flexdirection="column">
        <h1>You have not yet applied this semester.</h1>
        <Link to="/apply">
          <Button>Apply!</Button>
        </Link>
      </Container>
    );

  // Hasn't interviewed yet
  if (!application.interview.interviewed)
    return (
      <Container flexdirection="column">
        <h1>You must first complete your interview!</h1>
      </Container>
    );

  // Deliberations are incomplete or feedback hasn't been given
  if (
    settings.deliberationsOpen ||
    (!application.deliberation.accepted &&
      application.deliberation.feedback === "")
  )
    // TODO: make this centered, prettier
    return (
      <Container flexdirection="column">
        <h1>Deliberations are still underway!</h1>
      </Container>
    );

  // Denied but waiting for emails to go out
  if (
    !application.deliberation.accepted &&
    application.deliberation.feedback !== ""
  )
    return (
      <Container flexdirection="column">
        <h1>Keep an eye on your inbox for an update on your deliberation!</h1>
      </Container>
    );

  // Theyre accepted and need to confirm
  // TODO: get eboard to fix the wording
  if (!application.deliberation.confirmed) {
    const ResultText = () =>
      settings.useTwoRoundDeliberations && !authUser.roles.provisionalMember ? (
        <>
          <h2>You have been provisionally accepted into UPE!</h2>
          <br />
          <p>
            We are pleased to extend to you provisional membership to UPE. This
            means that you are now on the way to becoming a fully fledged member
            of our group. Now you must go through the provisional period
            requirements as described in the info sessions. If you'd like to
            accept this and start your onboarding period, please click the
            button below to confirm.
          </p>
        </>
      ) : (
        <>
          <h2>You have been officially accepted into UPE!</h2>
          <br />
          <p>
            We are pleased to announce that you have been officially accepted
            into UPE. In order for us to complete this process, we require that
            you confirm your acceptance by clicking below.
          </p>
        </>
      );

    return (
      <Container flexdirection="column">
        <div>
          <h1>Your Results</h1>
        </div>
        <br />
        <div>
          <ResultText />
          <Button onClick={confirm}>Confirm</Button>
        </div>
      </Container>
    );
  }

  // make this pretty
  if (authUser.profileIMG !== "")
    return (
      <Container flexdirection="column">
        <h1>You're all set!</h1>
      </Container>
    );

  return (
    <Container flexdirection="column">
      <div>
        <h1>Next Steps</h1>
        <p>
          Now that you've accepted to join UPE, you will continue on with the
          onboarding period, during this time, and has mentioned during the Info
          Sessions, you will be required to attend chapter, meet current
          members, and contribute in some way to UPE. Further details about this
          will be given to you shortly by our Recruitment Team.
        </p>
        <p>
          For the time being however, we ask that you fill out the form bellow,
          so that once onboarding is over, we can induct you and add you to our
          database & website in a timely manner.
        </p>
      </div>
      <br />
      <h2> Data Form </h2>
      <DataForm
        submitFunction={submitData}
        firstName={authUser.name.split(" ")[0]}
      />
    </Container>
  );
};

const DataForm = ({ submitFunction, firstName }) => {
  const [formData, setFormData] = useState({
    file: null,
    profileIMG: "",
    twitter: "",
    facebook: "",
    github: "",
    linkedin: "",
  });
  const [validated, setValidated] = useState(false);

  const setFileValidity = (fileUpload) => {
    if (fileUpload.files.length === 0) {
      fileUpload.setCustomValidity("You must upload a file!");
      swal("Uh oh!", "You must upload a file!", "error");
    } else if (fileUpload.files.length > 1) {
      fileUpload.setCustomValidity("You can only upload 1 file!");
      swal("Uh oh!", "You can only upload 1 file!", "error");
    } else if (fileUpload.files[0].size > 1048576 * 5) {
      fileUpload.setCustomValidity("Max file size is 5MB!");
      fileUpload.value = "";
      swal("Uh oh!", "Max file size is 5MB!", "error");
    } else {
      fileUpload.setCustomValidity("");
    }
  };

  const saveData = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileUploads = Array.from(form.querySelectorAll(".form-control-file"));
    fileUploads.forEach((fileUpload) => setFileValidity(fileUpload));
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      swal(
        "Missing photo!",
        "Please provide a headshot for your profile photo.",
        "error"
      );
    } else {
      submitFunction(cloneDeep(formData));
      setValidated(false);
    }
  };

  const updateField = (e) =>
    setFormData(
      update(formData, {
        [e.target.name]: { $set: e.target.value },
      })
    );

  const updateImage = (e) => {
    const hasIMG = e.target.files.length === 1;
    let fileName = "";
    // TODO: Needs refactor after website
    if (hasIMG) {
      if (e.target.files[0].type.split("/")[1] === "jpeg")
        fileName = firstName + ".jpg";
      else fileName = firstName + ".png";
    } else return;

    setFormData(
      update(formData, {
        file: { $set: hasIMG ? e.target.files[0] : "" },
        profileIMG: {
          $set: fileName,
        },
      })
    );
  };

  // TODO: Look into custom form issue
  return (
    <Container flexdirection="column">
      <Form noValidate validated={validated} onSubmit={saveData}>
        <Form.Row>
          <Form.Group>
            <Form.Label>
              <h5>
                Profile Image <RequiredAsterisk />
              </h5>
            </Form.Label>
            <Form.File
              name="profileIMG"
              accept=".png,.jpg"
              onChange={updateImage}
              required
            />
          </Form.Group>
        </Form.Row>

        <Form.Row>
          <Form.Group>
            <Form.Label>
              <h5>Twitter</h5>
            </Form.Label>
            <Form.Control
              name="twitter"
              type="url"
              placeholder="https://twitter.com/..."
              value={formData.twitter}
              onChange={updateField}
            />
          </Form.Group>
        </Form.Row>

        <Form.Row>
          <Form.Group>
            <Form.Label>
              <h5>
                Github <RequiredAsterisk />
              </h5>
            </Form.Label>
            <Form.Control
              name="github"
              type="url"
              placeholder="https://github.com/..."
              value={formData.github}
              onChange={updateField}
              required
            />
          </Form.Group>
        </Form.Row>

        <Form.Row>
          <Form.Group>
            <Form.Label>
              <h5>Facebook</h5>
            </Form.Label>
            <Form.Control
              name="facebook"
              type="url"
              placeholder="https://facebook.com/..."
              value={formData.facebook}
              onChange={updateField}
            />
          </Form.Group>
        </Form.Row>

        <Form.Row>
          <Form.Group>
            <Form.Label>
              <h5>
                Linkedin <RequiredAsterisk />
              </h5>
            </Form.Label>
            <Form.Control
              name="linkedin"
              type="url"
              placeholder="https://linkedin.com/..."
              value={formData.linkedin}
              onChange={updateField}
              required
            />
          </Form.Group>
        </Form.Row>

        <Button type="submit">Submit</Button>
      </Form>
    </Container>
  );
};

export default compose(
  withAuthorization(isApplicant),
  withFirebase
)(ApplicantView);
