const axios = require("axios");

const requestBody = {
  amount: "000000000200",
  processing_code: "000200",
  transaction_id: "123456789012",
  desc: "Test payment",
  merchant_id: "TTM-00009769",
  subscriber_number: "233549856098",
  'r-switch': "MTN",
};

axios
  .post("https://prod.theteller.net/v1.1/transaction/process", requestBody, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic eXVzc2lmNjcwZDM4M2NhZjU0NDpaV0kxWWpOallURmhOMk5qTTJFME5HRmpPVFJtWWpreU5UZzNaVGxtTjJNPQ==",
      "Cache-Control": "no-cache",
    },
  })
  .then((response) => console.log("Response:", response.data))
  .catch((error) =>
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    )
  );
