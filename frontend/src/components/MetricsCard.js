import React from "react";
import styled from "styled-components";

const Card = styled.div`
  background-color: #222;
  padding: 20px;
  border-radius: 10px;
  width: 200px;
  text-align: center;
  box-shadow: 0px 0px 10px rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  font-size: 1.2rem;
  color: white;
`;

const Value = styled.p`
  font-size: 2rem;
  font-weight: bold;
  color: ${(props) => props.color || "white"};
`;

const Subtext = styled.p`
  font-size: 0.9rem;
  color: gray;
`;

const MetricsCard = ({ title, value, color, subtext }) => {
  return (
    <Card>
      <Title>{title}</Title>
      <Value color={color}>{value}</Value>
      {subtext && <Subtext>{subtext}</Subtext>}
    </Card>
  );
};

export default MetricsCard;
