import axios from "axios";

export async function AI(question: any) {

    const prompt = `
You are an expert MySQL 8 developer.
Task: Convert the user question into a single raw SQL query that runs correctly in MySQL 8.

Rules:
1. ONLY output the SQL string.
2. No explanation, no backticks, no comments, no semicolons.
3. Use proper MySQL 8 syntax (e.g., INTERVAL 1 MONTH, NOW(), CURRENT_DATE, LIKE for pattern matching).
4. If you cannot answer, output: SELECT 'Error' FROM users LIMIT 1

Schema:
users(id, name, email, phone, is_active, created_at)
market_prices(product_id, unit_price, created_at)

Examples:
Question: how many users are there?
SQL: SELECT COUNT(*) FROM users

Question: show prices for product 5
SQL: SELECT unit_price FROM market_prices WHERE product_id = 5

Question: average price in the last month
SQL: SELECT AVG(unit_price) AS average_unit_price FROM market_prices WHERE created_at > CURRENT_DATE - INTERVAL 1 MONTH

Question: list all active users
SQL: SELECT * FROM users WHERE is_active = 1

Question: find user by email john@example.com
SQL: SELECT * FROM users WHERE email = 'john@example.com'

Question: show the 10 most recent users
SQL: SELECT * FROM users ORDER BY created_at DESC LIMIT 10

Question: total revenue for product 3
SQL: SELECT SUM(unit_price) AS total_revenue FROM market_prices WHERE product_id = 3

Question: highest price for product 7
SQL: SELECT MAX(unit_price) AS highest_price FROM market_prices WHERE product_id = 7

Question: lowest price for product 7
SQL: SELECT MIN(unit_price) AS lowest_price FROM market_prices WHERE product_id = 7

Question: average price for all products
SQL: SELECT AVG(unit_price) AS average_price FROM market_prices

Question: users created in the last week
SQL: SELECT * FROM users WHERE created_at > CURRENT_DATE - INTERVAL 7 DAY

Question: users whose name starts with 'A'
SQL: SELECT * FROM users WHERE name LIKE 'A%'

Question: users whose email contains 'gmail'
SQL: SELECT * FROM users WHERE email LIKE '%gmail%'

Question: count of active users
SQL: SELECT COUNT(*) AS active_users FROM users WHERE is_active = 1

Question: products with price above 100
SQL: SELECT * FROM market_prices WHERE unit_price > 100

Question: products with price between 50 and 200
SQL: SELECT * FROM market_prices WHERE unit_price BETWEEN 50 AND 200

Question: most expensive product
SQL: SELECT product_id, MAX(unit_price) AS max_price FROM market_prices

Question: cheapest product
SQL: SELECT product_id, MIN(unit_price) AS min_price FROM market_prices

Question: last price update for product 4
SQL: SELECT * FROM market_prices WHERE product_id = 4 ORDER BY created_at DESC LIMIT 1

Question: all users sorted by name
SQL: SELECT * FROM users ORDER BY name ASC

Question: count of users created each day
SQL: SELECT DATE(created_at) AS day, COUNT(*) AS total FROM users GROUP BY DATE(created_at) ORDER BY day

Question: average price per product
SQL: SELECT product_id, AVG(unit_price) AS average_price FROM market_prices GROUP BY product_id

Question: active users created this month
SQL: SELECT * FROM users WHERE is_active = 1 AND MONTH(created_at) = MONTH(CURRENT_DATE) AND YEAR(created_at) = YEAR(CURRENT_DATE)

Question: find users without phone number
SQL: SELECT * FROM users WHERE phone IS NULL

Question: last 5 price updates for all products
SQL: SELECT * FROM market_prices ORDER BY created_at DESC LIMIT 5

Question: find user named Ridoy
SQL: SELECT * FROM users WHERE name = 'Ridoy'

Question: ${question}
SQL:
`.trim();



    const response = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
        model: process.env.OLLAMA_MODEL,
        prompt,
        stream: false
    });

    let sql = response.data.response.trim();
    sql = sql.replace(/^```(?:sql|mysql)?\n?|```$/gi, '').trim();

    if (!sql.toLowerCase().startsWith('select')) {
        console.log('questions : ', question, 'sql :', sql)
        // throw new Error('Unsafe query detected: Only SELECT statements are allowed.');
        return;
    }

    return sql;
}