async function testBackendApi() {
    console.log('🔍 测试后端 API...\n');

    try {
        // 1. 测试健康检查
        console.log('1️⃣ 测试健康检查...');
        const healthRes = await fetch('http://localhost:3001/health');
        const health = await healthRes.json();
        console.log('   ✅ 后端运行正常:', health);

        // 2. 测试数据库查询
        console.log('\n2️⃣ 测试数据库查询（资产）...');
        const assetsRes = await fetch('http://localhost:3001/api/assets');
        const assetsData = await assetsRes.json();

        if (assetsData.success) {
            console.log(`   ✅ 成功查询到 ${assetsData.data.length} 个资产`);
            if (assetsData.data.length > 0) {
                console.log('   前3条资产:');
                console.table(assetsData.data.slice(0, 3));
            }
        } else {
            console.log('   ❌ 查询失败:', assetsData.error);
        }

        // 3. 测试规格查询
        console.log('\n3️⃣ 测试数据库查询（规格）...');
        const specsRes = await fetch('http://localhost:3001/api/asset-specs');
        const specsData = await specsRes.json();

        if (specsData.success) {
            console.log(`   ✅ 成功查询到 ${specsData.data.length} 个规格`);
            if (specsData.data.length > 0) {
                console.log('   前3条规格:');
                console.table(specsData.data.slice(0, 3));
            }
        } else {
            console.log('   ❌ 查询失败:', specsData.error);
        }

        // 4. 测试分类查询
        console.log('\n4️⃣ 测试数据库查询（分类）...');
        const classRes = await fetch('http://localhost:3001/api/classifications');
        const classData = await classRes.json();

        if (classData.success) {
            console.log(`   ✅ 成功查询到 ${classData.data.length} 个分类`);
        } else {
            console.log('   ❌ 查询失败:', classData.error);
        }

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    }
}

testBackendApi();
