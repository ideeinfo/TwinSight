
// Mock of server/routes/rds.js tree building logic

function buildTree(allNodes) {
    // Logic copied from server/routes/rds.js
    const nodeMap = new Map();
    const rootNodes = [];

    // 1. Initialize
    allNodes.forEach(node => {
        // Clone to avoid mutation issues in test
        const n = { ...node, children: [] };
        nodeMap.set(n.code, n);
    });

    // 2. Build Relations
    // Iterating original list to ensure order/completeness, but using map references
    allNodes.forEach(rawNode => {
        const node = nodeMap.get(rawNode.code);
        if (node.parent_code && nodeMap.has(node.parent_code)) {
            const parent = nodeMap.get(node.parent_code);
            parent.children.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    return rootNodes;
}

// Helper to print tree
function printTree(nodes, indent = '') {
    nodes.forEach(node => {
        console.log(`${indent}- [${node.code}] ${node.name} (ID: ${node.id})`);
        if (node.children.length > 0) {
            printTree(node.children, indent + '  ');
        }
    });
}

// --- Scenarios ---

// Scenario A: "Duplicate Objects" (Object claims Ancestors)
// Object A: "AH5" (ID: 1)
// Claimed Codes: ===P (Parent), ===P.AH5 (Child)
// Real Parent Object P: "10KV" (ID: 2) -> Claimed Code: ===P
console.log('\n--- Scenario A: Duplicate Aspects (Object claims Ancestor) ---');
const dataA = [
    { id: 1, code: '===P', parent_code: null, name: 'AH5 (Bad)' },
    { id: 1, code: '===P.AH5', parent_code: '===P', name: 'AH5 (Bad)' },
    // If Real Parent P exists too?
    { id: 2, code: '===P', parent_code: null, name: '10KV (Real)' }
    // Note: If both define ===P, nodeMap will overwrite! Last one wins.
];
const treeA = buildTree(dataA);
printTree(treeA);


// Scenario B: "Missing Container" (Orphaned Child)
// Object P: "10KV" (ID: 2). Claimed: ===P (Entity only, no Container ===P.)
// Object A: "AH5" (ID: 1). Claimed: ===P.AH5. Parent: ===P.
console.log('\n--- Scenario B: Missing Container (Orphaned Child) ---');
const dataB = [
    { id: 2, code: '===P', parent_code: null, name: '10KV' },
    // No ===P. node
    { id: 1, code: '===P.AH5', parent_code: '===P.', name: 'AH5' }
    // Note: Parent code is '===P.', but map only has '===P'
];
const treeB = buildTree(dataB);
printTree(treeB);


// Scenario C: "User Observation" (3 AH5s, Missing 10KV)
// How do we get 3 AH5s?
// Maybe AH5 claims ===A, ===A.B, ===A.B.C?
console.log('\n--- Scenario C: Recursive Self-Claim ---');
const dataC = [
    { id: 1, code: '===A', parent_code: null, name: 'AH5' },
    { id: 1, code: '===A.B', parent_code: '===A', name: 'AH5' },
    { id: 1, code: '===A.B.C', parent_code: '===A.B', name: 'AH5' }
];
const treeC = buildTree(dataC);
printTree(treeC);

