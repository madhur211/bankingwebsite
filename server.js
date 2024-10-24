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

    // Validate deposit amount
    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid deposit amount.' });
    }

    // Step 1: Find customer by reference number
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

        // Generate account number, customer ID, login ID, and password
        const accountNumber = Math.floor(Math.random() * 1000000000).toString();
        const customerId = `CUST${Math.floor(Math.random() * 100000)}`;
        const loginId = `LOGIN${Math.floor(Math.random() * 100000)}`;
        const password = Math.random().toString(36).slice(-8); // Random password of length 8

        // Step 2: Update customer details
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

            // Step 3: Insert into the accounts table
            const consumerNumber = `CN0${accountNumber}`; // Format for consumer number
            const insertAccountQuery = `
                INSERT INTO accounts (customer_id, account_type, account_type_detail, opening_date, balance, account_number, consumer_number)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            // Retrieve account type and details from customer
            const accountType = customer.account_type; // Assuming these fields exist in your customers table
            const accountTypeDetail = customer.account_type_detail;
            const openingDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // Current date

            db.query(insertAccountQuery, [customerId, accountType, accountTypeDetail, openingDate, depositAmount, accountNumber, consumerNumber], (err, result) => {
                if (err) {
                    console.error('Error inserting into accounts:', err);
                    return res.status(500).json({ success: false, message: 'Error inserting into accounts.' });
                }

                console.log('Account inserted successfully.');

                // Step 4: Insert into the transactions table
                const transactionId = `TRX${Math.floor(Math.random() * 1000000)}`; // Generate transaction ID
                const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD

                const insertTransactionQuery = `
                    INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars, balance_after)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                db.query(insertTransactionQuery, [customerId, transactionId, depositAmount, currentDate, 'ACCOUNT OPENING AMOUNT', depositAmount], (err, result) => {
                    if (err) {
                        console.error('Error inserting into transactions:', err);
                        return res.status(500).json({ success: false, message: 'Error inserting transaction.' });
                    }

                    console.log('Transaction inserted successfully with ID:', transactionId);

                    // Respond with success
                    res.json({
                        success: true,
                        message: 'Deposit successful!',
                        customerId,
                        accountNumber,
                        loginId,
                        password
                    });
                });
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


const PDFDocument = require('pdfkit');
const fs = require('fs');
const path1 = require('path');

app.post('/transfer/dd', (req, res) => {
    const { payeeName, amount, charges, totalAmount, referenceNumber, sourceAccountNumber } = req.body;

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Transaction start error' });
        }

        // Update the balance of the source account
        const updateSourceBalance = `UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ?`;
        db.query(updateSourceBalance, [totalAmount, sourceAccountNumber, totalAmount], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ message: 'Error updating source balance' });
                });
            }
            if (results.affectedRows === 0) {
                return db.rollback(() => {
                    res.status(400).json({ message: 'Insufficient funds or invalid account.' });
                });
            }

            // Insert into DD table with created_at instead of date
            const insertDD = `INSERT INTO dd (reference_number, payee_name, amount, charges, total_amount, created_at) VALUES (?, ?, ?, ?, ?, NOW())`;
            db.query(insertDD, [referenceNumber, payeeName, amount, charges, totalAmount], (err) => {
                if (err) {
                    console.error('Error inserting into DD table:', err);
                    return db.rollback(() => {
                        res.status(500).json({ message: 'Error inserting into DD table', error: err });
                    });
                }

                // Generate transaction ID
                const trxIdSource = `TRX${Math.floor(Math.random() * 100000)}`;

                // Insert transaction record
                const insertTransaction = `
                    INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars,dd_reference_number)
                    VALUES 
                    ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?, ?)
                `;
                const sourceParticulars = `Demand Draft issued to ${payeeName}`;

                db.query(insertTransaction, [sourceAccountNumber, trxIdSource, -totalAmount, sourceParticulars, referenceNumber], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ message: 'Transaction record insert error' });
                        });
                    }

                    // Update balance in the customers table
                    const updateCustomerBalance = `
                        UPDATE customers
                        SET balance = balance - ?
                        WHERE customer_id = (SELECT customer_id FROM accounts WHERE account_number = ?)
                    `;
                    db.query(updateCustomerBalance, [totalAmount, sourceAccountNumber], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ message: 'Error updating customer balance' });
                            });
                        }

                        // Fetch the updated balance and update the transaction record
                        const getSourceBalance = `SELECT balance FROM accounts WHERE account_number = ?`;
                        db.query(getSourceBalance, [sourceAccountNumber], (err, sourceResults) => {
                            if (err || sourceResults.length === 0) {
                                return db.rollback(() => {
                                    res.status(500).json({ message: 'Error fetching source account balance' });
                                });
                            }

                            const latestSourceBalance = sourceResults[0].balance;

                            const updateTransaction = `UPDATE transactions SET balance_after = ? WHERE transaction_id = ?`;
                            db.query(updateTransaction, [latestSourceBalance, trxIdSource], (err) => {
                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({ message: 'Error updating transactions' });
                                    });
                                }

                              
                                // Use the desktop path for saving the PDF
                                const desktopPath = path1.join(process.env.HOME || process.env.USERPROFILE, 'Desktop/Madhur');
                                
                                // Create the directory if it doesn't exist
                                if (!fs.existsSync(desktopPath)) {
                                    fs.mkdirSync(desktopPath, { recursive: true });
                                }

                                const pdfPath = path1.join(desktopPath, `${referenceNumber}.pdf`); // Define your path to save the PDF

                                // Create a new PDF document
                                const pdfDoc = new PDFDocument();

                                // Create PDF content
                                pdfDoc.pipe(fs.createWriteStream(pdfPath));
                                pdfDoc.fontSize(25).text('Demand Draft', { align: 'center' });
                                pdfDoc.moveDown();
                                pdfDoc.fontSize(12).text(`Reference Number: ${referenceNumber}`);
                                pdfDoc.text(`Payee Name: ${payeeName}`);
                                pdfDoc.text(`Amount: ₹${amount}`);
                                pdfDoc.text(`Charges: ₹${charges}`);
                                pdfDoc.text(`Total Amount: ₹${totalAmount}`);
                                pdfDoc.text(`Source Account Number: ${sourceAccountNumber}`);
                                pdfDoc.text(`Date: ${new Date().toLocaleDateString()}`);
                                pdfDoc.end();
                                   // Send success response and check for further issues
                                   res.json({
                                    message: `Demand Draft Transfer Successful! Reference Number: ${referenceNumber}. Your Demand Draft has been successfully processed. Please collect it from the branch.`,
                                    referenceNumber: referenceNumber,
                                    collectMessage: `Your Demand Draft with reference number ${referenceNumber} has been successfully processed. Please collect it from the branch.`,
                                    pdfPath: pdfPath // You can send back the path of the saved PDF
                                });

 // Debugging after response
 console.log("Demand Draft transfer success response sent!");
                                db.commit((err) => {
                                    if (err) {
                                        console.error('Error during commit:', err); // Log commit error
                                        return db.rollback(() => {
                                            res.status(500).json({ message: 'Commit error' });
                                        });
                                    }
                                    console.log('Demand Draft Transfer Successful!'); // Log success
                                
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// IMPS Transfer Endpoint
app.post('/transfer/imps', (req, res) => {
    const { scaccountnumber, mobileNumber, amount } = req.body;

    // Check if amount is valid for IMPS
    if (amount <= 0) {
        return res.status(400).json({ message: 'IMPS transfer amount must be greater than 0.' });
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

            // Get destination account details using mobile number
            const getDestinationAccount = `SELECT account_number FROM customers WHERE mobile_number = ?`;
            db.query(getDestinationAccount, [mobileNumber], (err, destinationResults) => {
                if (err || destinationResults.length === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ message: 'Invalid destination mobile number.' });
                    });
                }

                const destinationAccountNumber = destinationResults[0].account_number;

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

                    // Insert transaction records for both accounts
                    const insertTransaction = `
                        INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                        VALUES 
                        ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?),
                        ((SELECT customer_id FROM accounts WHERE account_number = ?), ?, ?, NOW(), ?)
                    `;
                    const sourceParticulars = `IMPS Transfer to ${mobileNumber}`;
                    const destinationParticulars = `IMPS Transfer from ${sourceAccountNumber}`;

                    db.query(insertTransaction, [
                        sourceAccountNumber, trxIdSource, -amount, sourceParticulars,
                        destinationAccountNumber, trxIdDestination, amount, destinationParticulars
                    ], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ message: 'Transaction record insert error' });
                            });
                        }

                        // Update sender's balance in customers table
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

                            // Update receiver's balance in customers table
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
                                                    res.json({ message: 'IMPS Transfer Successful!' });
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
});
// Route to fetch transactions for a customer
app.get('/transactions', (req, res) => {
    const customerId = req.query.customer_id;

    const query = `
        SELECT 
            t.transaction_id,
            t.date,
            t.particulars,
            t.amount,
            t.balance_after
        FROM 
            transactions t
        WHERE 
            t.customer_id = ?
    `;
    db.query(query, [customerId], (err, results) => {
        if (err) {
            console.error('Error fetching transactions:', err);
            return res.status(500).json({ success: false, error: 'Error fetching transactions' });
        }

        res.json({ success: true, transactions: results });
    });
});
// Generate Statement Endpoint
app.get('/generateStatement', (req, res) => {
    const customerId = req.query.customer_id;
    const startDate = req.query.startDate;  // Optional start date
    const endDate = req.query.endDate;      // Optional end date

    let query = `
        SELECT 
            t.transaction_id,
            t.date,
            t.particulars,
            t.amount,
            t.balance_after
        FROM 
            transactions t
        WHERE 
            t.customer_id = ?
    `;

    const queryParams = [customerId];

    // Check if startDate and endDate are provided, and adjust the query accordingly
    if (startDate && endDate) {
        query += ` AND t.date >= ? AND t.date <= ?`;
        queryParams.push(startDate, endDate);  // Add dates to query params
    }

    // Order by date for better readability
    query += ` ORDER BY t.date`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error generating statement:', err);
            return res.status(500).json({ success: false, error: 'Error generating statement' });
        }

        // Generate PDF if results are fetched successfully
        if (results.length > 0) {
            const pdfDoc = new PDFDocument();
            const desktopPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'Madhur');
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(desktopPath)) {
                fs.mkdirSync(desktopPath, { recursive: true });
            }

            const pdfPath = path.join(desktopPath, `Statement_${customerId}_${new Date().toISOString().split('T')[0]}.pdf`);

            // Stream PDF document to file
            pdfDoc.pipe(fs.createWriteStream(pdfPath));

            // Add title and metadata
            pdfDoc.fontSize(20).text('Bank Statement', { align: 'center' });
            pdfDoc.moveDown();
            pdfDoc.fontSize(12).text(`Customer ID: ${customerId}`);
            pdfDoc.text(`Date Range: ${startDate || 'N/A'} to ${endDate || 'N/A'}`);
            pdfDoc.text(`Generated on: ${new Date().toLocaleDateString()}`);
            pdfDoc.moveDown();

            // Add table headers
            pdfDoc.fontSize(12);
            pdfDoc.text('Transaction ID', 50, pdfDoc.y);
            pdfDoc.text('Date', 150, pdfDoc.y);
            pdfDoc.text('Particulars', 250, pdfDoc.y);
            pdfDoc.text('Amount', 400, pdfDoc.y);
            pdfDoc.text('Balance After', 500, pdfDoc.y);
            pdfDoc.moveDown();

            // Add transaction details
            results.forEach(transaction => {
                // Ensure amount and balance_after are numbers
                const amount = parseFloat(transaction.amount);
                const balanceAfter = parseFloat(transaction.balance_after);
                
                // Check for NaN values
                if (isNaN(amount) || isNaN(balanceAfter)) {
                    console.error('Invalid number detected in transaction:', transaction);
                    return; // Skip this iteration if there's an invalid number
                }

                pdfDoc.text(transaction.transaction_id, 50, pdfDoc.y);
                pdfDoc.text(transaction.date.toISOString().split('T')[0], 150, pdfDoc.y);
                pdfDoc.text(transaction.particulars, 250, pdfDoc.y);
                pdfDoc.text(`₹${amount.toFixed(2)}`, 400, pdfDoc.y);
                pdfDoc.text(`₹${balanceAfter.toFixed(2)}`, 500, pdfDoc.y);
                pdfDoc.moveDown(0.5); // Add some spacing between transactions
            });

            // Finalize the PDF and end the document
            pdfDoc.end();

            // Send response after PDF is generated
            res.json({
                success: true,
                message: 'Statement generated successfully.',
                pdfPath: pdfPath, // Send back the file path of the saved PDF
                transactions: results // Send back the transaction data as well
            });
        } else {
            res.json({
                success: false,
                message: 'No transactions found for the selected date range.'
            });
        }
    });
});
// Endpoint to submit FD
app.post('/submitFD', (req, res) => {
    const { customerId, customerName, amount, age, tenure, roi, totalAmount,maturityDate } = req.body;

    // Validate input data
    if (!customerId || !customerName || !amount || !age || !tenure || roi === undefined || totalAmount === undefined || !maturityDate) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
   // SQL query to insert data into the fixed_deposits table
    const query = `
        INSERT INTO fixed_deposits (customer_id, customer_name, amount, age, tenure, roi, total_amount, maturity_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [customerId, customerName, amount, age, tenure, roi, totalAmount, maturityDate];

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Transaction start error' });
        }

        db.query(query, values, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ message: 'Error inserting data into fixed_deposits' });
                });
            }

            // Retrieve current balance of the customer
            const getBalanceQuery = `SELECT balance FROM customers WHERE customer_id = ?`;
            db.query(getBalanceQuery, [customerId], (err, balanceResult) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ message: 'Error retrieving customer balance' });
                    });
                }

                const currentBalance = balanceResult[0].balance;

                // Deduct money from source account
                const sourceAccountNumber = customerId;
                const updateSourceBalance = `UPDATE accounts SET balance = balance - ? WHERE customer_id = ? AND balance >= ?`;
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

                    // Update sender balance in customers table
                    const updateCustomersTableSender = `
                        UPDATE customers
                        SET balance = balance - ?
                        WHERE customer_id = ?
                    `;
                    db.query(updateCustomersTableSender, [amount, sourceAccountNumber], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ message: 'Error updating customers table for sender' });
                            });
                        }

                        // Insert transaction record
                        const insertTransaction = `
                            INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars, balance_after)
                            VALUES (?, ?, ?, NOW(), ?, ?)
                        `;
                        const transactionId = `TRX${Math.floor(Math.random() * 100000)}`;
                        const particulars = `Fixed Deposit Creation`;
                        const balanceAfter = currentBalance - amount; // Update balance_after
                        db.query(insertTransaction, [sourceAccountNumber, transactionId, -amount, particulars, balanceAfter], (err) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ message: 'Error inserting transaction record' });
                                });
                            }

                            db.commit((err) => {
                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({ message: 'Transaction commit error' });
                                    });
                                }

                                // Create a PDF
                                const pdfData = {
                                    customerName,
                                    amount,
                                    age,
                                    tenure,
                                    roi,
                                    totalAmount,
                                    maturityDate,
                                    date: new Date().toLocaleDateString()
                                   
                                };

                                // Use the desktop path for saving the PDF
                                const desktopPath = path1.join(process.env.HOME || process.env.USERPROFILE, 'Desktop/Madhur');
                                
                                // Create the directory if it doesn't exist
                                if (!fs.existsSync(desktopPath)) {
                                    fs.mkdirSync(desktopPath, { recursive: true });
                                }

                                const pdfPath = path1.join(desktopPath, `FD_${customerName}.pdf`); // Define your path to save the PDF

                                // Create a new PDF document
                                const pdfDoc = new PDFDocument();

                                // Create PDF content
                                pdfDoc.pipe(fs.createWriteStream(pdfPath));
                                pdfDoc.fontSize(25).text('Fixed Deposit Receipt', { align: 'center' });
                                pdfDoc.moveDown();
                                pdfDoc.fontSize(12).text(`Customer Name: ${customerName}`);
                                pdfDoc.text(`Amount: ₹${amount}`);
                                pdfDoc.text(`Age: ${age}`);
                                pdfDoc.text(`Tenure: ${tenure} years`);
                                pdfDoc.text(`ROI: ${roi}%`);
                                pdfDoc.text(`Total Amount: ₹${totalAmount}`);
                                pdfDoc.text(`Date: ${pdfData.date}`);
                                pdfDoc.text(`Maturity Date: ${maturityDate}`);
                                pdfDoc.end();

                                res.status(200).json({ message: 'Fixed deposit created successfully', id: result.insertId });
                            });
                        });
                    });
                });
            });
        });
    });
});
app.get('/previousFDs', (req, res) => {
    const customerId = req.query.customerId; // Get customer ID from query parameters
    
    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    // Query to fetch previous FDs for the specified customer ID from 'fixed_deposits'
    const fdQuery = `
        SELECT 
            customer_name,  
            amount,
            age,
            tenure,
            roi,
            total_amount,
              maturity_date,
            created_at
        FROM 
            fixed_deposits
        WHERE 
            customer_id = ?;
    `;

    db.query(fdQuery, [customerId], (err, fdResults) => {
        if (err) {
            console.error('Error fetching previous FDs:', err);
            return res.status(500).json({ success: false, message: 'Failed to retrieve previous FDs.' });
        }

        if (fdResults.length > 0) {
            res.json({ success: true, fds: fdResults });
        } else {
            res.json({ success: false, message: 'No previous FDs found for this customer.' });
        }
    });
});

// Loan application endpoint
app.post('/apply-loan', (req, res) => {
    const { customerId, loanType, amount, tenure } = req.body;

    // Validate the input
    if (!customerId || !loanType || !amount || !tenure) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Parse amount and tenure to ensure they are valid numbers
    const parsedAmount = parseFloat(amount);
    const parsedTenure = parseFloat(tenure);

    if (isNaN(parsedAmount) || parsedAmount <= 0 || isNaN(parsedTenure) || parsedTenure <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount or tenure.' });
    }

    // Verify if the customerId exists in the customers table
    const customerQuery = 'SELECT * FROM customers WHERE customer_id = ?';
    db.query(customerQuery, [customerId], (customerErr, customerResults) => {
        if (customerErr) {
            console.error('Error fetching customer:', customerErr);
            return res.status(500).json({ success: false, message: 'Database error while fetching customer.' });
        }

        if (customerResults.length === 0) {
            // If no matching customer found
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        // Generate a unique reference ID
        const referenceId = `REF${Date.now()}-${customerId}`;

        // If customer exists, proceed to insert loan application
        const loansQuery = 'INSERT INTO loans (customerId, loanType, amount, tenure, referenceId) VALUES (?, ?, ?, ?, ?)';
        const loansValues = [customerId, loanType, parsedAmount, parsedTenure, referenceId];

        db.query(loansQuery, loansValues, (loansErr, loansResults) => {
            if (loansErr) {
                console.error('Error inserting loan application:', loansErr);
                return res.status(500).json({ success: false, message: 'Database error while inserting loan.' });
            }

            // Respond with success message if loan application is inserted successfully
            res.json({ success: true, message: 'Loan applied successfully!  Please visit the branch for further security purposes.', referenceId });
        });
    });
});

app.post('/get-loans', (req, res) => {
    const { customerId } = req.body;

    // Validate if customerId is provided
    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    // Define the loans query to fetch loans for the given customer including the referenceId
    const loansQuery = 'SELECT loan_id, loanType, amount, tenure, loanDate, referenceId FROM loans WHERE customerId = ?';
    const loansValues = [customerId];

    // Execute the loans query
    db.query(loansQuery, loansValues, (err, results) => {
        if (err) {
            console.error('Error fetching loans:', err);
            return res.status(500).json({ success: false, message: 'Database error while fetching loans.' });
        }

        // Respond with the list of loans
        res.json({ success: true, loans: results });
    });
});

// Account closure endpoint
app.post('/close-account', (req, res) => {
    console.log('Received request:', req.body); // Log the incoming request

    const { customerid, reason } = req.body;

    // Basic validation to ensure customerid and reason exist
    if (!customerid || !reason) {
        return res.status(400).json({ success: false, message: 'Customer ID and reason are required.' });
    }

    // Verify if the customerId exists in the customers table
    const customerQuery = 'SELECT * FROM customers WHERE customer_id = ?';
    db.query(customerQuery, [customerid], (customerErr, customerResults) => {
        if (customerErr) {
            console.error('Error fetching customer:', customerErr);
            return res.status(500).json({ success: false, message: 'Database error while fetching customer.' });
        }

        if (customerResults.length === 0) {
            // If no matching customer found
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        // SQL query to insert the closure request into the database
        const closureQuery = 'INSERT INTO account_clsre (customerid, reason) VALUES (?, ?)';
        db.query(closureQuery, [customerid, reason], (err, result) => {
            if (err) {
                console.error('Database query error:', err); // Log the database error
                return res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
            }

            console.log('Account closure request processed:', result);
            res.status(200).json({ success: true, message: 'Account closure request submitted successfully.Branch will contact you within 2days of request submission' });
        });
    });
});

app.post('/saveElectricityBill', (req, res) => {
    const { company_name, consumer_number, amount } = req.body;

    if (!company_name || !consumer_number || !amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const getAccountDetails = `SELECT customer_id, balance FROM accounts WHERE consumer_number = ?`;
    db.query(getAccountDetails, [consumer_number], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error fetching account details' });
        if (results.length === 0) return res.status(400).json({ success: false, message: 'Invalid consumer number' });

        const { customer_id } = results[0];
        const currentBalance = results[0].balance;

        if (currentBalance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const updateAccountsTable = `UPDATE accounts SET balance = balance - ? WHERE consumer_number = ?`;
        db.query(updateAccountsTable, [amount, consumer_number], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error updating accounts table' });

            const trxId = `TRX${Math.floor(Math.random() * 100000)}`;
            const particulars = `Electricity bill payment to ${company_name}`;
            const insertTransaction = `
                INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                VALUES (?, ?, ?, NOW(), ?)
            `;
            db.query(insertTransaction, [customer_id, trxId, -amount, particulars], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Transaction record insert error' });

                const updateCustomersTableSender = `
                    UPDATE customers
                    SET balance = balance - ?
                    WHERE customer_id = ?
                `;
                db.query(updateCustomersTableSender, [amount, customer_id], (err) => {
                    if (err) return res.status(500).json({ success: false, message: 'Error updating customers table for sender' });

                    const getAccountBalance = `SELECT balance FROM accounts WHERE consumer_number = ?`;
                    db.query(getAccountBalance, [consumer_number], (err, results) => {
                        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Error fetching account balance' });

                        const latestBalance = results[0].balance;
                        const updateTransactionBalance = `
                            UPDATE transactions
                            SET balance_after = ?
                            WHERE transaction_id = ?
                        `;
                        db.query(updateTransactionBalance, [latestBalance, trxId], (err) => {
                            if (err) return res.status(500).json({ success: false, message: 'Error updating transaction balance' });

                            res.json({ success: true, message: 'Electricity bill payment processed successfully!' });
                        });
                    });
                });
            });
        });
    });
});
app.post('/saveLpgBill', (req, res) => {
    const { company_name, consumer_number, amount } = req.body;

    if (!company_name || !consumer_number || !amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const getAccountDetails = `SELECT customer_id, balance FROM accounts WHERE consumer_number = ?`;
    db.query(getAccountDetails, [consumer_number], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error fetching account details' });
        if (results.length === 0) return res.status(400).json({ success: false, message: 'Invalid consumer number' });

        const { customer_id } = results[0];
        const currentBalance = results[0].balance;

        if (currentBalance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const updateAccountsTable = `UPDATE accounts SET balance = balance - ? WHERE consumer_number = ?`;
        db.query(updateAccountsTable, [amount, consumer_number], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error updating accounts table' });

            const trxId = `TRX${Math.floor(Math.random() * 100000)}`;
            const particulars = `LPG bill payment to ${company_name}`;
            const insertTransaction = `
                INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                VALUES (?, ?, ?, NOW(), ?)
            `;
            db.query(insertTransaction, [customer_id, trxId, -amount, particulars], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Transaction record insert error' });

                const updateCustomersTableSender = `
                    UPDATE customers
                    SET balance = balance - ?
                    WHERE customer_id = ?
                `;
                db.query(updateCustomersTableSender, [amount, customer_id], (err) => {
                    if (err) return res.status(500).json({ success: false, message: 'Error updating customers table for sender' });

                    const getAccountBalance = `SELECT balance FROM accounts WHERE consumer_number = ?`;
                    db.query(getAccountBalance, [consumer_number], (err, results) => {
                        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Error fetching account balance' });

                        const latestBalance = results[0].balance;
                        const updateTransactionBalance = `
                            UPDATE transactions
                            SET balance_after = ?
                            WHERE transaction_id = ?
                        `;
                        db.query(updateTransactionBalance, [latestBalance, trxId], (err) => {
                            if (err) return res.status(500).json({ success: false, message: 'Error updating transaction balance' });

                            res.json({ success: true, message: 'LPG bill payment processed successfully!' });
                        });
                    });
                });
            });
        });
    });
});
app.post('/saveWaterBill', (req, res) => {
    const { company_name, consumer_number, amount } = req.body;

    if (!company_name || !consumer_number || !amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const getAccountDetails = `SELECT customer_id, balance FROM accounts WHERE consumer_number = ?`;
    db.query(getAccountDetails, [consumer_number], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error fetching account details' });
        if (results.length === 0) return res.status(400).json({ success: false, message: 'Invalid consumer number' });

        const { customer_id } = results[0];
        const currentBalance = results[0].balance;

        if (currentBalance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const updateAccountsTable = `UPDATE accounts SET balance = balance - ? WHERE consumer_number = ?`;
        db.query(updateAccountsTable, [amount, consumer_number], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error updating accounts table' });

            const trxId = `TRX${Math.floor(Math.random() * 100000)}`;
            const particulars = `Water bill payment to ${company_name}`;
            const insertTransaction = `
                INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                VALUES (?, ?, ?, NOW(), ?)
            `;
            db.query(insertTransaction, [customer_id, trxId, -amount, particulars], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Transaction record insert error' });

                const updateCustomersTableSender = `
                    UPDATE customers
                    SET balance = balance - ?
                    WHERE customer_id = ?
                `;
                db.query(updateCustomersTableSender, [amount, customer_id], (err) => {
                    if (err) return res.status(500).json({ success: false, message: 'Error updating customers table for sender' });

                    const getAccountBalance = `SELECT balance FROM accounts WHERE consumer_number = ?`;
                    db.query(getAccountBalance, [consumer_number], (err, results) => {
                        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Error fetching account balance' });

                        const latestBalance = results[0].balance;
                        const updateTransactionBalance = `
                            UPDATE transactions
                            SET balance_after = ?
                            WHERE transaction_id = ?
                        `;
                        db.query(updateTransactionBalance, [latestBalance, trxId], (err) => {
                            if (err) return res.status(500).json({ success: false, message: 'Error updating transaction balance' });

                            res.json({ success: true, message: 'Water bill payment processed successfully!' });
                        });
                    });
                });
            });
        });
    });
});
app.post('/saveRecharge', (req, res) => {
    console.log('Received data:', req.body);
    const { mobile_number, mobile_operator, region, amount } = req.body;

    // Input validation
    if (!mobile_number || !mobile_operator || !region || !amount) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Check if amount is a valid number and greater than zero
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    // Fetch the customer ID based on the mobile number
    const getCustomerId = `SELECT customer_id FROM customers WHERE mobile_number = ?`;
    db.query(getCustomerId, [mobile_number], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Error fetching customer ID' });
        }
        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }

        const customerId = results[0].customer_id;

        // Fetch the balance from the accounts table using the customer ID
        const getAccountBalance = `SELECT balance FROM accounts WHERE customer_id = ?`;
        db.query(getAccountBalance, [customerId], (err, results) => {
            if (err || results.length === 0) {
                return res.status(500).json({ success: false, message: 'Error fetching account balance' });
            }

            const currentBalance = results[0].balance;

            // Check if there is sufficient balance
            if (currentBalance < amount) {
                return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }

            // Update the balance in the customers table first
            const updateCustomersTableSender = `
                UPDATE customers
                SET balance = balance - ?
                WHERE customer_id = ?
            `;
            db.query(updateCustomersTableSender, [amount, customerId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error updating customers table for sender' });
                }

                // Update the balance in the accounts table
                const updateAccountsTable = `UPDATE accounts SET balance = balance - ? WHERE customer_id = ?`;
                db.query(updateAccountsTable, [amount, customerId], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Error updating accounts table' });
                    }

                    // Insert the transaction record
                    const trxId = `TRX${Math.floor(Math.random() * 100000)}`;
                    const insertTransaction = `
                        INSERT INTO transactions (customer_id, transaction_id, amount, date, particulars)
                        VALUES (?, ?, ?, NOW(), ?)
                    `;
                    const particulars = `Mobile recharge to ${mobile_operator} (${region})`;
                    db.query(insertTransaction, [customerId, trxId, -amount, particulars], (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'Transaction record insert error' });
                        }

                        // Fetch the latest balance and update the transaction balance_after
                        db.query(getAccountBalance, [customerId], (err, results) => {
                            if (err || results.length === 0) {
                                return res.status(500).json({ success: false, message: 'Error fetching account balance' });
                            }

                            const latestBalance = results[0].balance;
                            const updateTransactionBalance = `
                                UPDATE transactions
                                SET balance_after = ?
                                WHERE transaction_id = ?
                            `;
                            db.query(updateTransactionBalance, [latestBalance, trxId], (err) => {
                                if (err) {
                                    return res.status(500).json({ success: false, message: 'Error updating transaction balance' });
                                }

                                res.json({ success: true, message: 'Mobile recharge processed successfully!' });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Fetch recent transactions endpoint
app.post('/recent-transactions', (req, res) => {
    const { customerId } = req.body;

    // Validate if customerId is provided
    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    // Define the transactions query to fetch the last 5 transactions for the given customer
    const transactionsQuery = `
        SELECT transaction_id, amount, date, particulars, balance_after 
        FROM transactions 
        WHERE customer_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 5
    `;
    const transactionsValues = [customerId];

    // Execute the transactions query
    db.query(transactionsQuery, transactionsValues, (err, results) => {
        if (err) {
            console.error('Error fetching transactions:', err);
            return res.status(500).json({ success: false, message: 'Database error while fetching transactions.' });
        }

        // Respond with the list of transactions
        res.json({ success: true, transactions: results });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
