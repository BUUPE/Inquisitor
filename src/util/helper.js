// formats a date into a AM/PM time string
export const formatTime = (date) => {
  let hours = date.getHours() % 12;
  if (hours === 0) hours = 12;
  hours = hours.toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} ${date.getHours() >= 12 ? "PM" : "AM"}`;
};
