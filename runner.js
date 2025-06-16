const sharkManager = require('./app/modules/shark');
const MyClass = new sharkManager()
// Recuperar o nome da função e os argumentos da linha de comando
const [,, methodName, ...args] = process.argv;

if (typeof MyClass[methodName] === 'function') {
  const result = MyClass[methodName](...args);
  console.log(result);
} else {
  console.error(`Method "${methodName}" not found in MyClass.`);
}
