import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  clientEmail?: string
  vendorName?: string
  vendorCategory?: string
  projectName?: string
  weddingDate?: string
  commentBody?: string
  adminUrl?: string
}

const CommentEmail = ({
  clientName = 'A client',
  clientEmail,
  vendorName = 'a vendor',
  vendorCategory,
  projectName,
  weddingDate,
  commentBody = '',
  adminUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New comment from ${clientName} on ${vendorName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New comment from {clientName}</Heading>
        <Text style={text}>
          {clientName}{clientEmail ? ` (${clientEmail})` : ''} left a comment on{' '}
          <strong>{vendorName}</strong>{vendorCategory ? ` · ${vendorCategory}` : ''}.
        </Text>
        {projectName && (
          <Text style={meta}>
            Project: <strong>{projectName}</strong>
            {weddingDate ? ` · Wedding on ${weddingDate}` : ''}
          </Text>
        )}
        <Section style={quote}>
          <Text style={quoteText}>{commentBody}</Text>
        </Section>
        {adminUrl && (
          <Text style={text}>
            <a href={adminUrl} style={link}>Open project in admin →</a>
          </Text>
        )}
        <Hr style={hr} />
        <Text style={footer}>Saffron Events · Internal notification</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CommentEmail,
  subject: (d: Record<string, any>) =>
    `New comment from ${d.clientName ?? 'a client'} on ${d.vendorName ?? 'a vendor'}`,
  displayName: 'Client comment notification',
  to: 'info@saffronevents.in',
  previewData: {
    clientName: 'Aanya Mehta',
    clientEmail: 'aanya@example.com',
    vendorName: 'Lotus Decor',
    vendorCategory: 'Decor',
    projectName: 'Aanya & Rohan',
    weddingDate: '12 Feb 2026',
    commentBody: 'Loved their portfolio! Can we ask them about mandap variants?',
    adminUrl: 'https://planwithsaffron.in/admin/projects/123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#2a2118', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#3a2f24', lineHeight: '1.55', margin: '0 0 12px' }
const meta = { fontSize: '13px', color: '#6b5d4f', margin: '0 0 16px' }
const quote = {
  borderLeft: '3px solid #c87553',
  background: '#fbf6ef',
  padding: '12px 14px',
  margin: '12px 0 16px',
  borderRadius: '4px',
}
const quoteText = { fontSize: '14px', color: '#2a2118', whiteSpace: 'pre-wrap' as const, margin: 0, lineHeight: '1.55' }
const link = { color: '#c87553', textDecoration: 'underline' }
const hr = { borderColor: '#ece4d6', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9b8d7a', margin: 0 }
