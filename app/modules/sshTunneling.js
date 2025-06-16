const Ssh2Promise = require('ssh2-promise');
async function connectToServer(connection,info,itsAClass = true) {
  const ssh = new Ssh2Promise({
    host: '134.209.215.199',
    username: 'root',
    password: 'sh4rk@Orbis',
    port:22,
    readyTimeout: 10000, // 10 segundos para handshake
    keepaliveInterval: 60000, // Envia keepalive a cada 60 segundos
    });

  const tunnel = await ssh.addTunnel({
    remoteAddr: 'localhost', //This is the database connection ip@, once connected to it you can fetch from LOCALHOST. Incase its AWS it would be test.test-test.amazonaws.com
    remotePort: 5432, //Port for connection
    localPort: 15432,
  });
  console.log('oskoalwd')
  if(itsAClass){
    return new connection(info);

  }else{
    return connection(info);
  }

}
module.exports = connectToServer;
