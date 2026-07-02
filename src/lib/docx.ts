import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

type Email = { subject: string; body: string }
type Drafts = { email1: Email; email2: Email; email3: Email; linkedin_note: string; linkedin_followup: string }

export async function buildSequenceDocx(companyName: string, d: Drafts): Promise<Buffer> {
  const emailSection = (title: string, e: Email) => [
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun({ text: `Subject: ${e.subject}`, bold: true })] }),
    ...e.body.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })),
  ]
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Cold Email Sequence — ${companyName}`)] }),
        new Paragraph({ children: [new TextRun('（本文档由 CXODEX 国际市场开拓工作台生成，请人工发送，工具不代发。）')] }),
        ...emailSection('Email 1 · Day 0 (competitor hook)', d.email1),
        ...emailSection('Email 2 · +3 days (OEM / private label)', d.email2),
        ...emailSection('Email 3 · +7 days (zero-risk close)', d.email3),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('LinkedIn connection note (≤300 chars)')] }),
        new Paragraph({ children: [new TextRun(d.linkedin_note)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('LinkedIn follow-up after accept')] }),
        new Paragraph({ children: [new TextRun(d.linkedin_followup)] }),
      ],
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
