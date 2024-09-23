const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Madhur@2110*',
    database: 'banking'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the MySQL database:', err);
        process.exit(1);
    }
    console.log('Connected to the MySQL database.');
});
// Route to retrieve the security question for the given username
// Route to retrieve the security question for the given login_id
app.post('/getSecurityQuestion', (req, res) => {
    const { login_id } = req.body;

    const query = 'SELECT security_question FROM customers WHERE login_id = ?';
    db.query(query, [login_id], (err, results) => {
        if (err) {
            console.error('Error fetching security question:', err);
            return res.status(500).json({ success: false, message: 'Error retrieving security question.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Login ID not found.' });
        }

        res.json({ success: true, securityQuestion: results[0].security_question });
    });
});

// Route to reset the password after verifying the security answer
app.post('/resetPassword', (req, res) => {
    const { login_id, securityAnswer, newPassword } = req.body;

    const query = 'SELECT * FROM customers WHERE login_id = ? AND security_answer = ?';
    db.query(query, [login_id, securityAnswer], (err, results) => {
        if (err) {
            console.error('Error verifying security answer:', err);
            return res.status(500).json({ success: false, message: 'Error verifying security answer.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid security answer.' });
        }

        const updateQuery = 'UPDATE customers SET password = ? WHERE login_id = ?';
        db.query(updateQuery, [newPassword, login_id], (err) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ success: false, message: 'Error resetting password.' });
            }

            res.json({ success: true, message: 'Password successfully updated.' });
        });
    });
});
// Route to retrieve the login ID for the given name, account_number, and PAN
app.post('/getUsername', (req, res) => {
    const { name, account_number, pan } = req.body;

    const query = 'SELECT login_id FROM customers WHERE name = ? AND account_number = ? AND pan = ?';
    db.query(query, [name, account_number, pan], (err, results) => {
        if (err) {
            console.error('Error fetching login ID:', err);
            return res.status(500).json({ success: false, message: 'Error retrieving login ID.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No matching record found.' });
        }

        res.json({ success: true, login_id: results[0].login_id });
    });
});


// Check for unique constraints
function checkUniqueField(field, value, callback) {
    const query = `SELECT COUNT(*) AS count FROM customers WHERE ${field} = ?`;
    db.query(query, [value], (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results[0].count === 0);
    });
}

app.post('/register', (req, res) => {
    const {
        name, dob, gender, pan, aadhar, accountType,
        jointName, jointDob, jointGender, jointPan, jointAadhar,
        address, email, operationMode, accountTypeDetail,
        securityQuestion, securityAnswer,mobile
    } = req.body;

    const referenceNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const accOpeningDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD

    const fieldsToCheck = [
        { field: 'email', value: email },
        { field: 'login_id', value: req.body.login_id },
        { field: 'customer_id', value: req.body.customer_id },
        { field: 'account_number', value: req.body.account_number }
    ];

    let checksRemaining = fieldsToCheck.length;
    let hasError = false;

    fieldsToCheck.forEach(({ field, value }) => {
        if (hasError) return;
        checkUniqueField(field, value, (err, isUnique) => {
            if (err) {
                res.status(500).json({ success: false, message: 'Database error' });
                hasError = true;
                return;
            }
            if (!isUnique) {
                res.status(400).json({ success: false, message: `${field} already exists` });
                hasError = true;
                return;
            }
            checksRemaining -= 1;
            if (checksRemaining === 0) {
                let query;
                let values;

                if (accountType === 'joint') {
                    query = `
                        INSERT INTO customers (
                            name, dob, gender, pan, aadhar, joint_name, joint_dob, joint_gender, joint_pan, joint_aadhar,
                            account_type, address, email, operation_mode, account_type_detail, reference_number, security_question, security_answer, acc_opening_date,mobile_number
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)
                    `;
                    values = [
                        name, dob, gender, pan, aadhar, jointName, jointDob, jointGender, jointPan, jointAadhar,
                        accountType, address, email, operationMode, accountTypeDetail, referenceNumber, securityQuestion, securityAnswer, accOpeningDate,mobile
                    ];
                } else {
                    query = `
                        INSERT INTO customers (
                            name, dob, gender, pan, aadhar, account_type, address, email, operation_mode, account_type_detail,
                            reference_number, security_question, security_answer, acc_opening_date,mobile_number
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)
                    `;
                    values = [
                        name, dob, gender, pan, aadhar, accountType, address, email, operationMode, accountTypeDetail,
                        referenceNumber, securityQuestion, securityAnswer, accOpeningDate,mobile
                    ];
                }

                db.query(query, values, (err, result) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        return res.status(500).json({ success: false, message: 'Error registering customer.' });
                    }
                    res.json({ success: true, referenceNumber });
                });
            }
        });
    });
});


// ATM deposit route
app.post('/atmDeposit', (req, res) => {
    const { referenceNumber, depositAmount } = req.body;

    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid deposit amount.' });
    }

    const findCustomerQuery = 'SELECT * FROM customers WHERE reference_number = ?';
    db.query(findCustomerQuery, [referenceNumber], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ success: false, message: 'Error finding customer.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Reference number not found.' });
        }

        const customer = results[0];

        const accountNumber = Math.floor(Math.random() * 1000000000).toString();
        const customerId = `CUST${Math.floor(Math.random() * 100000)}`;
        const loginId = `LOGIN${Math.floor(Math.random() * 100000)}`;
        const password = Math.random().toString(36).slice(-8);

        const updateCustomerQuery = `
            UPDATE customers 
            SET account_number = ?, customer_id = ?, login_id = ?, password = ?, balance = ? 
            WHERE reference_number = ?
        `;
        db.query(updateCustomerQuery, [accountNumber, customerId, loginId, password, depositAmount, referenceNumber], (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ success: false, message: 'Error updating customer.' });
            }
            res.json({
                success: true,
                message: 'Deposit successful!',
                customerId, accountNumber, loginId, password
            });
        });
    });
});

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM customers WHERE login_id = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.json({ success: false, message: 'Invalid credentials' });
        }
    });
});
// Route to handle logout (for completeness)
app.post('/logout', (req, res) => {
    // Handle logout logic here if needed
    res.json({ success: true, message: 'Logout successful' });
});
// Fetch user details for dashboard
app.get('/dashboard', (req, res) => {
    const { username } = req.query;

    const query = 'SELECT * FROM customers WHERE login_id = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    });
});


// RTGS Transfer Endpoint
app.post('/transfer/rtgs', (req, res) => {
    const { scaccountnumber, destinationAccountNumber, amount } = req.body;

    // Check if amount is valid for RTGS
    if (amount < 200000) {
        return res.status(400).json({ message: 'RTGS transfer amount must be above 2 lakhs.' });
    }

    const sourceAccountNumber = scaccountnumber;

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Transaction start error' });
        }

        // Update source account balance
        const updateSourceBalance = `UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ?`;
        db.query(updateSourceBalance, [amount, sourceAccountNumber, amount], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ message: 'Error updating source balance' });
                });
            }
            if (results.affectedRows === 0) {
                return db.rollback(() => {
                    res.status(400).json({ message: 'Insufficient funds or invalid source account number.' });
                });
            }

            // Update destination account balance
            const updateDestinationBalance = `UPDATE accounts SET balance = balance + ? WHERE account_number = ?`;
            db.query(updateDestinationBalance, [amount, destinationAccountNumber], (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ message: 'Error updating destination balance' });
                    });
                }
                if (results.affectedRows === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ message: 'Invalid destination account number.' });
                    });
                }

                // Generate transaction IDs
                const trxIdSource = `TRX${Math.floor(Math.random() * 100000)}`;
                const trxIdDestination = `TRX${Math.floor(Math.random() * 100000)}`;

                // Insert transaction records
                const insertTransaction = `
                    INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                    VALUES 
                    ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?),
                    ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?)
                `;
                const sourceParticulars = `RTGS Transfer to ${destinationAccountNumber}`;
                const destinationParticulars = `RTGS Transfer from ${sourceAccountNumber}`;

                db.query(insertTransaction, [
                    sourceAccountNumber, trxIdSource, -amount, sourceParticulars,
                    destinationAccountNumber, trxIdDestination, amount, destinationParticulars
                ], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ message: 'Transaction record insert error' });
                        });
                    }

                    // Update sender balance in customers table
                    const updateCustomersTableSender = `
                        UPDATE customers
                        SET balance = balance - ?
                        WHERE customer_id = (SELECT customer_id FROM accounts WHERE account_number = ?)
                    `;
                    db.query(updateCustomersTableSender, [amount, sourceAccountNumber], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ message: 'Error updating customers table for sender' });
                            });
                        }

                        // Update receiver balance in customers table
                        const updateCustomersTableReceiver = `
                            UPDATE customers
                            SET balance = balance + ?
                            WHERE customer_id = (SELECT customer_id FROM accounts WHERE account_number = ?)
                        `;
                        db.query(updateCustomersTableReceiver, [amount, destinationAccountNumber], (err) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ message: 'Error updating customers table for receiver' });
                                });
                            }

                            // Fetch the latest source account balance and update balance_after in transactions
                            const getSourceBalance = `SELECT balance FROM accounts WHERE account_number = ?`;
                            db.query(getSourceBalance, [sourceAccountNumber], (err, sourceResults) => {
                                if (err || sourceResults.length === 0) {
                                    return db.rollback(() => {
                                        res.status(500).json({ message: 'Error fetching source account balance' });
                                    });
                                }

                                const latestSourceBalance = sourceResults[0].balance;

                                const updateTransactionTable = `
                                    UPDATE transactions
                                    SET balance_after = ?
                                    WHERE transaction_id = ?
                                `;
                                db.query(updateTransactionTable, [latestSourceBalance, trxIdSource], (err) => {
                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({ message: 'Error updating transactions table' });
                                        });
                                    }

                                    // Fetch and update destination account balance for balance_after
                                    db.query(getSourceBalance, [destinationAccountNumber], (err, destResults) => {
                                        if (err || destResults.length === 0) {
                                            return db.rollback(() => {
                                                res.status(500).json({ message: 'Error fetching destination account balance' });
                                            });
                                        }

                                        const latestDestBalance = destResults[0].balance;

                                        db.query(updateTransactionTable, [latestDestBalance, trxIdDestination], (err) => {
                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({ message: 'Error updating destination transaction' });
                                                });
                                            }

                                            db.commit((err) => {
                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({ message: 'Transaction commit error' });
                                                    });
                                                }
                                                res.json({ message: 'RTGS Transfer Successful!' });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// NEFT Transfer Endpoint
app.post('/transfer/neft', (req, res) => {
    const { scaccountnumber, destinationAccountNumber, amount } = req.body;

    // Check if amount is valid for NEFT
    if (amount >= 200000) {
        return res.status(400).json({ message: 'NEFT transfer amount must be below 2 lakhs.' });
    }

    const sourceAccountNumber = scaccountnumber;

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Transaction start error' });
        }

        // Update source account balance
        const updateSourceBalance = `UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ?`;
        db.query(updateSourceBalance, [amount, sourceAccountNumber, amount], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ message: 'Error updating source balance' });
                });
            }
            if (results.affectedRows === 0) {
                return db.rollback(() => {
                    res.status(400).json({ message: 'Insufficient funds or invalid source account number.' });
                });
            }

            // Update destination account balance
            const updateDestinationBalance = `UPDATE accounts SET balance = balance + ? WHERE account_number = ?`;
            db.query(updateDestinationBalance, [amount, destinationAccountNumber], (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ message: 'Error updating destination balance' });
                    });
                }
                if (results.affectedRows === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ message: 'Invalid destination account number.' });
                    });
                }

                // Generate transaction IDs
                const trxIdSource = `TRX${Math.floor(Math.random() * 100000)}`;
                const trxIdDestination = `TRX${Math.floor(Math.random() * 100000)}`;

                // Insert transaction records
                const insertTransaction = `
                    INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                    VALUES 
                    ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?),
                    ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?)
                `;
                const sourceParticulars = `NEFT Transfer to ${destinationAccountNumber}`;
                const destinationParticulars = `NEFT Transfer from ${sourceAccountNumber}`;

                db.query(insertTransaction, [
                    sourceAccountNumber, trxIdSource, -amount, sourceParticulars,
                    destinationAccountNumber, trxIdDestination, amount, destinationParticulars
                ], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ message: 'Transaction record insert error' });
                        });
                    }

                    // Update sender balance in customers table
                    const updateCustomersTableSender = `
                        UPDATE customers
                        SET balance = balance - ?
                        WHERE customer_id = (SELECT customer_id FROM accounts WHERE account_number = ?)
                    `;
                    db.query(updateCustomersTableSender, [amount, sourceAccountNumber], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ message: 'Error updating customers table for sender' });
                            });
                        }

                        // Update receiver balance in customers table
                        const updateCustomersTableReceiver = `
                            UPDATE customers
                            SET balance = balance + ?
                            WHERE customer_id = (SELECT customer_id FROM accounts WHERE account_number = ?)
                        `;
                        db.query(updateCustomersTableReceiver, [amount, destinationAccountNumber], (err) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ message: 'Error updating customers table for receiver' });
                                });
                            }

                            // Fetch the latest source account balance and update balance_after in transactions
                            const getSourceBalance = `SELECT balance FROM accounts WHERE account_number = ?`;
                            db.query(getSourceBalance, [sourceAccountNumber], (err, sourceResults) => {
                                if (err || sourceResults.length === 0) {
                                    return db.rollback(() => {
                                        res.status(500).json({ message: 'Error fetching source account balance' });
                                    });
                                }

                                const latestSourceBalance = sourceResults[0].balance;

                                const updateTransactionTable = `
                                    UPDATE transactions
                                    SET balance_after = ?
                                    WHERE transaction_id = ?
                                `;
                                db.query(updateTransactionTable, [latestSourceBalance, trxIdSource], (err) => {
                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({ message: 'Error updating transactions table' });
                                        });
                                    }

                                    // Fetch and update destination account balance for balance_after
                                    db.query(getSourceBalance, [destinationAccountNumber], (err, destResults) => {
                                        if (err || destResults.length === 0) {
                                            return db.rollback(() => {
                                                res.status(500).json({ message: 'Error fetching destination account balance' });
                                            });
                                        }

                                        const latestDestBalance = destResults[0].balance;

                                        db.query(updateTransactionTable, [latestDestBalance, trxIdDestination], (err) => {
                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({ message: 'Error updating destination transaction' });
                                                });
                                            }

                                            db.commit((err) => {
                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({ message: 'Transaction commit error' });
                                                    });
                                                }
                                                res.json({ message: 'NEFT Transfer Successful!' });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});


// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
