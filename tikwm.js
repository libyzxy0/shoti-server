const axios = require('axios');

const getVideoInfo = async (url) => {
  try {
    const response = await axios.get(`https://tikwm.com/api?url=${url}`, { url });
    return response.data;
  } catch (err) {
    console.log(err);
    return null;
  }
};

module.exports = { getVideoInfo };
