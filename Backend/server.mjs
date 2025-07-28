import 'dotenv/config' 
import app from './app.mjs'
import DBConfig from './config/DBConfig.mjs'

const port = process.env.PORT_NUMBER || 5000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
})
