const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const app = require('./src/app')

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the old backend server or set a different PORT.`);
        process.exit(1);
    }

    console.error(error);
    process.exit(1);
})
