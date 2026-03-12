const bcrypt = require('bcryptjs');

async function testSeeding() {
    const password = '1234';
    const hash = await bcrypt.hash(password, 10);
    console.log(`Password: ${password}`);
    console.log(`Generated Hash: ${hash}`);
    
    // Simulating the check
    const isValid = await bcrypt.compare('1234', hash);
    console.log(`Is '1234' valid? ${isValid}`);
    
    if (isValid) {
        console.log('✅ Seeding logic verification: SUCCESS');
    } else {
        console.log('❌ Seeding logic verification: FAILED');
    }
}

testSeeding();
