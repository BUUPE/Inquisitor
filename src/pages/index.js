import React from "react";
import styled from "styled-components";

import SEO from "../components/SEO";
import Logo from "../components/Logo";

const Landing = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;

  p {
    max-width: 500px;
    text-align: center;
  }
`;

const IndexPage = () => (
  <>
    <SEO title="Home" route="/" />
    <Landing>
      <Logo size="medium" />
      <h1>Welcome!</h1>
      <p>
        This is BU UPE's recruitment tool. Please login to get started; you will
        see links based on your status.
      </p>
    </Landing>
  </>
);

export default IndexPage;
