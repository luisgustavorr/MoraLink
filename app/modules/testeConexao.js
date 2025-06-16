const fb = require("node-firebird");
fb.attach(
  {
    host: 'localhost',
    port: '3050',
    database: 'D:\\codeThings\\Firebird\\Firebird_3_0\\TESTE.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
  },
  function (err, db) {
    if (err) {
      console.log(err.message);
    } else {
      let database = db;
      console.log("connected");
      database.startTransaction(
        function(err, transaction) {
            checkError(err);
            transaction.query(`SELECT '[' || LIST(  '{' ||  '"nome": "' || PRODUTO.DESCRICAO || '", ' ||  '"produto_id": ' || PRODUTO.ID_PRODUTO || ', ' ||  '"quantidade": ' || PRODUTO.UNIDADE || ', ' ||  '"valor_unitario": ' || produto.PRECO ||  '}', ', '  ) || ']' AS "produtos_venda"  FROM PRODUTO GROUP BY ID_CATEGORIA_PRODUTO ;`, 123,
                check(transaction, function(err, result1) {
                  let teste = result1.map((e) => {
                    console.log(e.produtos_venda(transaction,(e=> {
                      console.log('e',e)
                    })))
                    return e
                  })
                    console.log(teste)
                })
            );
        }
      )
    }
  }
);
function checkError(err) {
  if (err) {
      throw new Error(err.message)
  }
}
function check(tr, callback){
  return function(err, param) {
      if (!err) {
          callback(err, param);
      } else {
          tr.rollback();
          throw new Error(err.message)
      }
  }
}

