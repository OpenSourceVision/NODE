const fs = require('fs-extra');
const yaml = require('yaml');
const path = require('path');
const axios = require('axios');
const https = require('https');

// 加载配置文件
let config = {};
try {
    config = require('./config.json');
} catch (error) {
    console.warn('无法加载配置文件，使用默认配置');
    config = {
        network: { timeout: 45000, retries: 3, maxRedirects: 5, ignoreSSLErrors: true },
        output: { directory: 'out', saveRawFiles: true, base64Encode: true },
        parsing: { supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard'], skipComments: true },
        logging: { level: 'info', showProgress: true }
    };
}

// 日志记录器
class Logger {
    constructor(level = 'info') {
        this.level = level;
        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    }
    
    log(level, message, ...args) {
        if (this.levels[level] <= this.levels[this.level]) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
        }
    }
    
    error(message, ...args) { this.log('error', message, ...args); }
    warn(message, ...args) { this.log('warn', message, ...args); }
    info(message, ...args) { this.log('info', message, ...args); }
    debug(message, ...args) { this.log('debug', message, ...args); }
}

const logger = new Logger(config.logging?.level || 'info');

// 进度条
class ProgressBar {
    constructor(total, showProgress = true) {
        this.total = total;
        this.current = 0;
        this.showProgress = showProgress;
    }
    
    update(current, message = '') {
        this.current = current;
        if (this.showProgress) {
            const percent = Math.round((current / this.total) * 100);
            const bar = '█'.repeat(Math.round(percent / 5)) + '░'.repeat(20 - Math.round(percent / 5));
            process.stdout.write(`\r[${bar}] ${percent}% ${message}`);
            if (current === this.total) {
                console.log(); // 换行
            }
        }
    }
}

// 读取URL配置文件
async function readUrlConfig() {
    try {
        const content = await fs.readFile('url.yaml', 'utf8');
        const urls = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        logger.info(`从配置文件读取到 ${urls.length} 个URL`);
        return urls;
    } catch (error) {
        logger.error('读取url.yaml文件失败:', error.message);
        return [];
    }
}

// 从URL获取节点数据（带重试机制）
async function fetchNodesFromUrl(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.debug(`正在获取节点数据 (尝试 ${attempt}/${retries}): ${url}`);
            
            const response = await axios.get(url, {
                timeout: config.network?.timeout || 45000,
                maxRedirects: config.network?.maxRedirects || 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
                headers: {
                    'User-Agent': 'clash-verge/v1.6.6',
                    'Accept': 'text/yaml,application/yaml,text/plain,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: !(config.network?.ignoreSSLErrors !== false)
                })
            });
            
            let data = response.data;
            
            // 如果是base64编码的数据，先解码
            if (typeof data === 'string' && !data.includes('proxies:') && !data.includes('servers:')) {
                try {
                    const decoded = Buffer.from(data, 'base64').toString('utf8');
                    if (decoded.includes('://') || decoded.includes('proxies:')) {
                        data = decoded;
                        logger.debug('检测到base64编码数据，已解码');
                    }
                } catch (e) {
                    logger.debug('非base64数据，保持原样');
                }
            }
            
            logger.info(`✓ 成功获取数据: ${url}`);
            return data;
            
        } catch (error) {
            logger.warn(`✗ 获取失败 (尝试 ${attempt}/${retries}) ${url}:`, error.message);
            
            if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                logger.debug(`等待 ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    return null;
}

// 解析节点数据
function parseNodes(data) {
    const nodes = [];
    
    if (!data) return nodes;
    
    try {
        // 解析YAML格式
        if (data.includes('proxies:') || data.includes('servers:')) {
            try {
                const yamlData = yaml.parse(data);
                if (yamlData.proxies && Array.isArray(yamlData.proxies)) {
                    nodes.push(...yamlData.proxies);
                    logger.debug(`从YAML解析到 ${yamlData.proxies.length} 个节点`);
                }
                if (yamlData.servers && Array.isArray(yamlData.servers)) {
                    nodes.push(...yamlData.servers);
                    logger.debug(`从YAML解析到 ${yamlData.servers.length} 个服务器节点`);
                }
            } catch (yamlError) {
                logger.warn('YAML解析失败:', yamlError.message);
            }
        }
        
        // 解析JSON格式
        if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
            try {
                const jsonData = JSON.parse(data);
                if (jsonData.proxies && Array.isArray(jsonData.proxies)) {
                    nodes.push(...jsonData.proxies);
                    logger.debug(`从JSON解析到 ${jsonData.proxies.length} 个节点`);
                }
                if (Array.isArray(jsonData)) {
                    nodes.push(...jsonData);
                    logger.debug(`从JSON数组解析到 ${jsonData.length} 个节点`);
                }
            } catch (jsonError) {
                logger.warn('JSON解析失败:', jsonError.message);
            }
        }
        
        // 解析单行节点格式
        const lines = data.split('\n');
        let lineNodeCount = 0;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && 
                (!config.parsing?.skipComments || (!trimmedLine.startsWith('#') && !trimmedLine.startsWith('//')))) {
                
                const supportedProtocols = config.parsing?.supportedProtocols || [
                    'ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard'
                ];
                
                const protocolPrefixes = supportedProtocols.map(p => `${p}://`);
                
                if (protocolPrefixes.some(prefix => trimmedLine.startsWith(prefix))) {
                    const parsedNode = parseProxyUrl(trimmedLine);
                    if (parsedNode) {
                        nodes.push(parsedNode);
                        lineNodeCount++;
                    }
                }
            }
        }
        
        if (lineNodeCount > 0) {
            logger.debug(`从单行格式解析到 ${lineNodeCount} 个节点`);
        }
        
    } catch (error) {
        logger.error('解析节点数据失败:', error.message);
    }
    
    return nodes.filter(node => node !== null);
}

// 解析代理URL
function parseProxyUrl(url) {
    try {
        if (!url || typeof url !== 'string') {
            return null;
        }
        
        const trimmedUrl = url.trim();
        
        const protocolMap = {
            'ss://': { type: 'ss', protocol: 'shadowsocks' },
            'ssr://': { type: 'ssr', protocol: 'shadowsocksr' },
            'vmess://': { type: 'vmess', protocol: 'vmess' },
            'vless://': { type: 'vless', protocol: 'vless' },
            'trojan://': { type: 'trojan', protocol: 'trojan' },
            'hysteria://': { type: 'hysteria', protocol: 'hysteria' },
            'hysteria2://': { type: 'hysteria2', protocol: 'hysteria2' },
            'tuic://': { type: 'tuic', protocol: 'tuic' },
            'wireguard://': { type: 'wireguard', protocol: 'wireguard' },
            'http://': { type: 'http', protocol: 'http' },
            'https://': { type: 'https', protocol: 'https' },
            'socks5://': { type: 'socks5', protocol: 'socks5' },
            'socks4://': { type: 'socks4', protocol: 'socks4' }
        };
        
        for (const [prefix, protocolConfig] of Object.entries(protocolMap)) {
            if (trimmedUrl.startsWith(prefix)) {
                return {
                    type: protocolConfig.type,
                    url: trimmedUrl,
                    protocol: protocolConfig.protocol,
                    originalUrl: url
                };
            }
        }
        
        return null;
    } catch (error) {
        logger.error('解析代理URL失败:', error.message, 'URL:', url);
        return null;
    }
}

// 获取节点协议类型
function getNodeProtocol(node) {
    if (typeof node === 'string') {
        const parsed = parseProxyUrl(node);
        return parsed ? parsed.protocol : 'unknown';
    }
    
    return node.type || node.protocol || 'unknown';
}

// 节点去重函数
function deduplicateNodes(nodes) {
    const seen = new Set();
    const deduplicated = [];
    
    for (const node of nodes) {
        let key;
        
        if (typeof node === 'string') {
            // 对于字符串节点，直接使用URL作为去重键
            key = node.trim();
        } else if (node.url) {
            // 对于有URL的节点对象
            key = node.url.trim();
        } else {
            // 对于YAML格式的节点对象，使用服务器+端口+协议作为去重键
            const server = node.server || '';
            const port = node.port || '';
            const type = node.type || node.protocol || '';
            const uuid = node.uuid || node.password || '';
            key = `${type}://${server}:${port}:${uuid}`;
        }
        
        if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(node);
        }
    }
    
    return deduplicated;
}

// 按协议分类节点
function classifyNodesByProtocol(nodes) {
    const classified = {};
    
    for (const node of nodes) {
        const protocol = getNodeProtocol(node);
        
        if (!classified[protocol]) {
            classified[protocol] = [];
        }
        
        classified[protocol].push(node);
    }
    
    return classified;
}

// 保存原始节点到raw目录
async function saveRawNodes(classifiedNodes) {
    const rawDir = path.join(__dirname, 'raw');
    await fs.ensureDir(rawDir);
    
    for (const [protocol, nodes] of Object.entries(classifiedNodes)) {
        try {
            let content = '';
            
            if (nodes.length > 0) {
                if (typeof nodes[0] === 'string') {
                    content = nodes.join('\n');
                } else if (nodes[0].url) {
                    content = nodes.map(node => node.url).join('\n');
                } else {
                    content = yaml.stringify({ proxies: nodes });
                }
            }
            
            const rawFilename = `${protocol}_raw.txt`;
            const rawFilepath = path.join(rawDir, rawFilename);
            await fs.writeFile(rawFilepath, content);
            logger.info(`已保存 ${nodes.length} 个原始 ${protocol} 节点到 raw/${rawFilename}`);
            
        } catch (error) {
            logger.error(`保存原始 ${protocol} 节点失败:`, error.message);
        }
    }
}

// 将YAML格式节点转换为URI格式
function convertYamlNodeToUri(node) {
    try {
        if (!node || typeof node !== 'object') {
            return null;
        }
        
        const type = node.type;
        const name = node.name || 'Unknown';
        const server = node.server;
        const port = node.port;
        
        if (!server || !port) {
            return null;
        }
        
        switch (type) {
            case 'ss': {
                const cipher = node.cipher || 'aes-256-gcm';
                const password = node.password || '';
                
                // 构建 ss:// URI
                const auth = Buffer.from(`${cipher}:${password}`).toString('base64');
                const encodedName = encodeURIComponent(name);
                return `ss://${auth}@${server}:${port}#${encodedName}`;
            }
            
            case 'vmess': {
                const uuid = node.uuid || '';
                const alterId = node.alterId || 0;
                const security = node.cipher || 'auto';
                const network = node.network || 'tcp';
                
                const vmessConfig = {
                    v: '2',
                    ps: name,
                    add: server,
                    port: port.toString(),
                    id: uuid,
                    aid: alterId.toString(),
                    scy: security,
                    net: network,
                    type: 'none',
                    host: node.host || '',
                    path: node.path || '',
                    tls: node.tls ? 'tls' : '',
                    sni: node.sni || ''
                };
                
                const encoded = Buffer.from(JSON.stringify(vmessConfig)).toString('base64');
                return `vmess://${encoded}`;
            }
            
            case 'trojan': {
                const password = node.password || '';
                const sni = node.sni || server;
                const allowInsecure = node['skip-cert-verify'] ? '1' : '0';
                const encodedName = encodeURIComponent(name);
                
                return `trojan://${password}@${server}:${port}?allowInsecure=${allowInsecure}&sni=${sni}#${encodedName}`;
            }
            
            case 'hysteria2': {
                const password = node.password || '';
                const sni = node.sni || server;
                const allowInsecure = node['skip-cert-verify'] ? '1' : '0';
                const encodedName = encodeURIComponent(name);
                
                return `hysteria2://${password}@${server}:${port}?insecure=${allowInsecure}&sni=${sni}&fastopen=1#${encodedName}`;
            }
            
            case 'hysteria': {
                const auth = node.auth_str || node.auth || '';
                const upmbps = node.up || '100';
                const downmbps = node.down || '100';
                const allowInsecure = node['skip-cert-verify'] ? '1' : '0';
                const alpn = node.alpn && node.alpn.length > 0 ? node.alpn[0] : 'h3';
                const peer = node.sni || node.peer || 'apple.com';
                const protocol = node.protocol || 'udp';
                const encodedName = encodeURIComponent(name);
                
                return `hysteria://${server}:${port}?upmbps=${upmbps}&downmbps=${downmbps}&auth=${auth}&insecure=${allowInsecure}&alpn=${alpn}&peer=${peer}&protocol=${protocol}&udp=true&fastopen=1#${encodedName}`;
            }
            
            case 'vless': {
                const uuid = node.uuid || '';
                const security = node.security || 'none';
                const type = node.type || 'tcp';
                const allowInsecure = node['skip-cert-verify'] ? '1' : '0';
                const sni = node.sni || server;
                const fp = node.fp || 'chrome';
                const flow = node.flow || '';
                const alpn = node.alpn || 'h3';
                const sid = node.sid || '';
                const pbk = node.pbk || '';
                const encodedName = encodeURIComponent(name);
                
                let params = `security=${security}&type=${type}&alpn=${alpn}&allowInsecure=${allowInsecure}&sni=${sni}&fp=${fp}`;
                if (flow) params += `&flow=${flow}`;
                if (sid) params += `&sid=${sid}`;
                if (pbk) params += `&pbk=${pbk}`;
                
                return `vless://${uuid}@${server}:${port}?${params}#${encodedName}`;
            }
            
            default:
                return null;
        }
    } catch (error) {
        logger.debug(`转换节点为URI失败:`, error.message);
        return null;
    }
}

// 保存去重后的节点到out目录
async function saveDeduplicatedNodes(classifiedNodes) {
    const outDir = path.join(__dirname, config.output?.directory || 'out');
    await fs.ensureDir(outDir);
    
    for (const [protocol, nodes] of Object.entries(classifiedNodes)) {
        try {
            let content = '';
            
            if (nodes.length > 0) {
                if (typeof nodes[0] === 'string') {
                    content = nodes.join('\n');
                } else if (nodes[0].url) {
                    content = nodes.map(node => node.url).join('\n');
                } else {
                    // 对于YAML格式的节点，转换为URI格式
                    const uriNodes = nodes.map(node => {
                        // 如果节点有完整的URI信息，直接返回
                        if (node.originalUrl) {
                            return node.originalUrl;
                        }
                        
                        // 尝试转换为URI格式
                        const uri = convertYamlNodeToUri(node);
                        if (uri) {
                            return uri;
                        }
                        
                        // 如果转换失败，保持YAML格式
                        return yaml.stringify(node).trim();
                    }).filter(uri => uri && uri.trim());
                    
                    content = uriNodes.join('\n');
                }
            }
            
            // 保存URI格式文件
            const filename = `${protocol}.txt`;
            const filepath = path.join(outDir, filename);
            await fs.writeFile(filepath, content);
            logger.info(`已保存 ${nodes.length} 个去重后的 ${protocol} 节点到 ${filename} (URI格式)`);
            
        } catch (error) {
            logger.error(`保存去重后的 ${protocol} 节点失败:`, error.message);
        }
    }
}

// 保存所有节点到all.txt文件
async function saveAllNodesFile(classifiedNodes) {
    const outDir = path.join(__dirname, config.output?.directory || 'out');
    await fs.ensureDir(outDir);
    
    const allNodes = [];
    
    // 收集所有协议的节点
    for (const [protocol, nodes] of Object.entries(classifiedNodes)) {
        if (nodes.length > 0) {
            if (typeof nodes[0] === 'string') {
                allNodes.push(...nodes);
            } else if (nodes[0].url) {
                allNodes.push(...nodes.map(node => node.url));
            } else {
                // 对于YAML格式的节点，转换为URI格式
                const uriNodes = nodes.map(node => {
                    // 如果节点有完整的URI信息，直接返回
                    if (node.originalUrl) {
                        return node.originalUrl;
                    }
                    
                    // 尝试转换为URI格式
                    const uri = convertYamlNodeToUri(node);
                    if (uri) {
                        return uri;
                    }
                    
                    // 如果转换失败，保持YAML格式
                    return yaml.stringify(node).trim();
                }).filter(uri => uri && uri.trim());
                
                allNodes.push(...uriNodes);
            }
        }
    }
    
    if (allNodes.length > 0) {
        try {
            const content = allNodes.join('\n');
            
            // 保存URI格式文件
            const filepath = path.join(outDir, 'all.txt');
            await fs.writeFile(filepath, content);
            logger.info(`已保存 ${allNodes.length} 个节点到 all.txt (URI格式)`);
            
        } catch (error) {
            logger.error('保存all.txt文件失败:', error.message);
        }
    }
}

// 主函数
async function main() {
    try {
        logger.info('=== 智能节点分类器启动 ===');
        logger.info(`配置: 超时=${config.network?.timeout}ms, 重试=${config.network?.retries}次`);
        
        const urls = await readUrlConfig();
        if (urls.length === 0) {
            logger.warn('没有找到有效的URL');
            return;
        }
        
        const progress = new ProgressBar(urls.length, config.logging?.showProgress);
        const allNodes = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            progress.update(i, `处理 ${url.substring(0, 50)}...`);
            
            const data = await fetchNodesFromUrl(url, config.network?.retries || 3);
            if (data) {
                const nodes = parseNodes(data);
                allNodes.push(...nodes);
                logger.info(`从 ${url} 获取到 ${nodes.length} 个节点`);
            }
        }
        
        progress.update(urls.length, '完成');
        
        logger.info(`总共获取到 ${allNodes.length} 个节点`);
        
        if (allNodes.length === 0) {
            logger.warn('没有获取到任何节点');
            return;
        }
        
        // 1. 分类原始节点
        const classifiedNodes = classifyNodesByProtocol(allNodes);
        
        logger.info('原始节点分类统计:');
        for (const [protocol, nodes] of Object.entries(classifiedNodes)) {
            logger.info(`  ${protocol}: ${nodes.length} 个节点`);
        }
        
        // 2. 保存原始节点到raw目录
        logger.info('\n=== 保存原始节点到raw目录 ===');
        await saveRawNodes(classifiedNodes);
        
        // 3. 对每个协议的节点进行去重
        logger.info('\n=== 开始节点去重处理 ===');
        const deduplicatedClassifiedNodes = {};
        let totalOriginal = 0;
        let totalDeduplicated = 0;
        
        for (const [protocol, nodes] of Object.entries(classifiedNodes)) {
            const originalCount = nodes.length;
            const deduplicatedNodes = deduplicateNodes(nodes);
            const deduplicatedCount = deduplicatedNodes.length;
            
            deduplicatedClassifiedNodes[protocol] = deduplicatedNodes;
            totalOriginal += originalCount;
            totalDeduplicated += deduplicatedCount;
            
            const removedCount = originalCount - deduplicatedCount;
            if (removedCount > 0) {
                logger.info(`  ${protocol}: ${originalCount} -> ${deduplicatedCount} (去重 ${removedCount} 个)`);
            } else {
                logger.info(`  ${protocol}: ${originalCount} 个节点 (无重复)`);
            }
        }
        
        const totalRemoved = totalOriginal - totalDeduplicated;
        logger.info(`\n去重统计: 原始 ${totalOriginal} 个节点 -> 去重后 ${totalDeduplicated} 个节点 (移除 ${totalRemoved} 个重复节点)`);
        
        // 4. 保存去重后的节点到out目录
        logger.info('\n=== 保存去重后的节点到out目录 ===');
        await saveDeduplicatedNodes(deduplicatedClassifiedNodes);
        
        // 5. 生成包含所有节点的all.txt文件
        await saveAllNodesFile(deduplicatedClassifiedNodes);
        
        logger.info('\n=== 处理完成 ===');
        
    } catch (error) {
        logger.error('程序执行失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { main, parseNodes, classifyNodesByProtocol, Logger };