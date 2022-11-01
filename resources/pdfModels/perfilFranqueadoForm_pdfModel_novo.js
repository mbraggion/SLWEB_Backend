const Helpers = use("Helpers");
const moment = require('moment')

exports.PDFGen = (Form) => {
  //obj que vai virar pdf
  var docDefinition = {
    // watermark: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
    content: [
      { text: "Formulário de Perfil", style: "header" },
      {
        image: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
        width: 100,
        absolutePosition: { x: 460, y: 10 },
      },
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 10, 0, 5],
      },
    },
  };

  for (let i = 1; i < Object.keys(Form).length; i++) {
    if (i + 1 < Object.keys(Form).length) {
      docDefinition.content.push({
        unbreakable: true,
        stack: [{
          columns: [
            genColumnDef(Object.keys(Form)[i], Form[Object.keys(Form)[i]]),
            genColumnDef(Object.keys(Form)[i + 1], Form[Object.keys(Form)[i + 1]])
          ],
        }]
      })
      i += 1
    } else {
      docDefinition.content.push({
        unbreakable: true,
        stack: [{
          columns: [
            genColumnDef(Object.keys(Form)[i], Form[Object.keys(Form)[i]])
          ],
        }]
      })
    }
  }

  return docDefinition;
};

const genColumnDef = (sessaoNome, questoes) => {
  if(sessaoNome === 'Encerramento'){
    return
  }
  let aux = []

  aux.push({ text: sessaoNome, style: "subheader" })

  if(questoes.length > 0){
    questoes.forEach(q => {
      let i = q.answer !== null && q.answer !== '' ? {
        width: '50%',
        margin: [0, 5, 0, 0],
        text: `${q.slug}: ${q.answerComponentType === 'date' && q.answer !== null ? moment(q.answer).format('L') : q.answer}`
      } : null
  
      aux.push(i)
    })
  }else{
    aux.push({
      width: '50%',
      margin: [0, 5, 0, 0],
      text: `AUSENTE`
    })
  }
  

  return aux.filter(q => q !== null)
}
