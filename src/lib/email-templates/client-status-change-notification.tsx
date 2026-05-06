import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  clientEmail?: string
  vendorName?: string
  vendorCategory?: string
  projectName?: string
  weddingDate?: string
  previousStatus?: string | null
  newStatus?: string | null
  adminUrl?: string
}

const labelFor = (s: string | null | undefined) => {
  if (!s) return 'No status'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const StatusEmail = ({
  clientName = 'A client',
  clientEmail,
  vendorName = 'a vendor',
  vendorCategory,
  projectName,
  weddingDate,
  previousStatus,
  newStatus,
  adminUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${clientName} marked ${vendorName} as ${labelFor(newStatus)}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{clientName} updated a vendor status</Heading>
        <Text style={text}>
          {clientName}{clientEmail ? ` (${clientEmail})` : ''} changed the status of{' '}
          <strong>{vendorName}</strong>{vendorCategory ? ` · ${vendorCategory}` : ''}.
        </Text>
        {projectName && (
          <Text style={meta}>
            Project: <strong>{projectName}</strong>
            {weddingDate ? ` · Wedding on ${weddingDate}` : ''}
          </Text>
        )}
        <Text style={pillRow}>
          <span style={pill}>{labelFor(previousStatus)}</span>
          <span style={arrow}>→</span>
          <span style={pillNew}>{labelFor(newStatus)}</span>
        </Text>
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
  component: StatusEmail,
  subject: (d: Record<string, any>) =>
    `${d.clientName ?? 'A client'} marked ${d.vendorName ?? 'a vendor'} as ${labelFor(d.newStatus)}`,
  displayName: 'Client vendor status change',
  to: 'info@saffronevents.in',
  previewData: {
    clientName: 'Aanya Mehta',
    clientEmail: 'aanya@example.com',
    vendorName: 'Lotus Decor',
    vendorCategory: 'Decor',
    projectName: 'Aanya & Rohan',
    weddingDate: '12 Feb 2026',
    previousStatus: 'shortlisted',
    newStatus: 'finalised',
    adminUrl: 'https://planwithsaffron.in/admin/projects/123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#2a2118', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#3a2f24', lineHeight: '1.55', margin: '0 0 12px' }
const meta = { fontSize: '13px', color: '#6b5d4f', margin: '0 0 16px' }
const pillRow = { fontSize: '14px', margin: '8px 0 16px' }
const pill = {
  display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
  background: '#ece4d6', color: '#6b5d4f', fontSize: '12px', fontWeight: 600,
}
const pillNew = {
  display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
  background: '#c87553', color: '#ffffff', fontSize: '12px', fontWeight: 600,
}
const arrow = { margin: '0 8px', color: '#9b8d7a' }
const link = { color: '#c87553', textDecoration: 'underline' }
const hr = { borderColor: '#ece4d6', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9b8d7a', margin: 0 }
