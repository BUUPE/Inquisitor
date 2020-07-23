import React, { Component, Fragment } from "react";
import { withTheme } from "styled-components";

import getFirebase, { FirebaseContext } from "./Firebase";
import withAuthentication from "./Session/withAuthentication";
import Header from "./Header";
import Footer from "./Footer";
import GlobalStyle from "../styles/global";

import "bootstrap/dist/css/bootstrap.min.css";

class Layout extends Component {
  state = {
    firebase: null,
  };

  componentDidMount() {
    const app = import("firebase/app");
    const auth = import("firebase/auth");
    const firestore = import("firebase/firestore");

    Promise.all([app, auth, firestore]).then((values) => {
      const firebase = getFirebase(values[0]);

      this.setState({ firebase });
    });
  }

  render() {
    return (
      <FirebaseContext.Provider value={this.state.firebase}>
        <AppWithAuthentication {...this.props} />
      </FirebaseContext.Provider>
    );
  }
}

const LayoutBase = withTheme((props) => (
  <Fragment>
    <GlobalStyle theme={props.theme} />
    <Header />
    {props.children}
    <Footer />
  </Fragment>
));

const AppWithAuthentication = withAuthentication(({ children }) => (
  <LayoutBase>{children}</LayoutBase>
));

export default Layout;