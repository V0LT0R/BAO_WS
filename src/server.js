const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'BAO' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));