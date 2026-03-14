-- Benchmark seed: Bulk up data to 500+ documents, 20+ users, 100+ issues
-- Run AFTER standard db:seed. Adds data on top of existing seed.

-- ============================================================
-- 1. Add 15 more users (to reach 26 total)
-- ============================================================
DO $$
DECLARE
  ws_id UUID;
  new_user_id UUID;
  person_doc_id UUID;
  pw_hash TEXT;
  i INT;
  names TEXT[] := ARRAY[
    'Liam Parker', 'Olivia Reed', 'Noah Scott', 'Sophia Turner',
    'Mason Clark', 'Isabella Hall', 'Ethan Young', 'Mia King',
    'Lucas Wright', 'Amelia Adams', 'Logan Baker', 'Harper Nelson',
    'Aiden Mitchell', 'Ella Carter', 'Jackson Phillips'
  ];
  emails TEXT[] := ARRAY[
    'liam@ship.local', 'olivia@ship.local', 'noah@ship.local', 'sophia@ship.local',
    'mason@ship.local', 'isabella@ship.local', 'ethan@ship.local', 'mia@ship.local',
    'lucas@ship.local', 'amelia@ship.local', 'logan@ship.local', 'harper@ship.local',
    'aiden@ship.local', 'ella@ship.local', 'jackson@ship.local'
  ];
BEGIN
  SELECT id INTO ws_id FROM workspaces LIMIT 1;
  -- bcrypt hash for 'admin123'
  pw_hash := '$2a$10$8KzaNdKIMyOkASCSnBoKn.rBSsFptMSbR1BPxYGQGz1F5Ey.BGJqq';

  FOR i IN 1..15 LOOP
    -- Skip if user already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = emails[i]) THEN
      INSERT INTO users (name, email, password_hash)
        VALUES (names[i], emails[i], pw_hash)
        RETURNING id INTO new_user_id;

      INSERT INTO workspace_memberships (user_id, workspace_id, role)
        VALUES (new_user_id, ws_id, 'member');

      INSERT INTO documents (title, document_type, workspace_id, created_by, properties)
        VALUES (names[i], 'person', ws_id, new_user_id,
          jsonb_build_object('user_id', new_user_id::text, 'email', emails[i]))
        RETURNING id INTO person_doc_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. Add ~200 more issues (to reach 300+ issues)
-- ============================================================
DO $$
DECLARE
  ws_id UUID;
  creator_id UUID;
  program_ids UUID[];
  project_ids UUID[];
  sprint_ids UUID[];
  user_ids UUID[];
  new_doc_id UUID;
  i INT;
  statuses TEXT[] := ARRAY['backlog', 'todo', 'in_progress', 'in_review', 'done'];
  priorities TEXT[] := ARRAY['critical', 'high', 'medium', 'low', 'none'];
  titles TEXT[] := ARRAY[
    'Fix pagination on large datasets',
    'Add search indexing for documents',
    'Optimize database query for sprint view',
    'Implement bulk export feature',
    'Add keyboard shortcuts to editor',
    'Fix timezone handling in sprint dates',
    'Add email notification preferences',
    'Improve error messages for form validation',
    'Add drag-and-drop to kanban board',
    'Fix memory leak in WebSocket connection',
    'Add dark mode support',
    'Implement undo/redo for editor',
    'Add activity feed to dashboard',
    'Fix sort order persistence',
    'Add markdown table support',
    'Implement issue templates',
    'Fix duplicate notification bug',
    'Add bulk status change',
    'Improve loading states',
    'Add sprint velocity chart'
  ];
BEGIN
  SELECT id INTO ws_id FROM workspaces LIMIT 1;
  SELECT id INTO creator_id FROM users WHERE email = 'dev@ship.local';
  SELECT array_agg(id) INTO program_ids FROM documents WHERE document_type = 'program' AND workspace_id = ws_id;
  SELECT array_agg(id) INTO project_ids FROM documents WHERE document_type = 'project' AND workspace_id = ws_id;
  SELECT array_agg(id) INTO sprint_ids FROM documents WHERE document_type = 'sprint' AND workspace_id = ws_id;
  SELECT array_agg(id) INTO user_ids FROM users;

  FOR i IN 1..200 LOOP
    INSERT INTO documents (
      title, document_type, workspace_id, created_by,
      properties, content
    ) VALUES (
      titles[1 + (i % 20)] || ' (#' || i || ')',
      'issue',
      ws_id,
      user_ids[1 + (i % array_length(user_ids, 1))],
      jsonb_build_object(
        'status', statuses[1 + (i % 5)],
        'priority', priorities[1 + (i % 5)],
        'estimate', (i % 8) + 1,
        'assignee_id', user_ids[1 + (i % array_length(user_ids, 1))]::text
      ),
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Benchmark issue body for load testing."}]}]}'::jsonb
    ) RETURNING id INTO new_doc_id;

    -- Associate with a program and project
    INSERT INTO document_associations (document_id, related_id, relationship_type, metadata)
      VALUES (new_doc_id, program_ids[1 + (i % array_length(program_ids, 1))], 'program', '{"created_via":"benchmark"}')
      ON CONFLICT DO NOTHING;

    INSERT INTO document_associations (document_id, related_id, relationship_type, metadata)
      VALUES (new_doc_id, project_ids[1 + (i % array_length(project_ids, 1))], 'project', '{"created_via":"benchmark"}')
      ON CONFLICT DO NOTHING;

    -- Associate half with sprints
    IF i % 2 = 0 THEN
      INSERT INTO document_associations (document_id, related_id, relationship_type, metadata)
        VALUES (new_doc_id, sprint_ids[1 + (i % array_length(sprint_ids, 1))], 'sprint', '{"created_via":"benchmark"}')
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. Add ~150 wiki documents (to push total well past 500)
-- ============================================================
DO $$
DECLARE
  ws_id UUID;
  creator_id UUID;
  user_ids UUID[];
  new_doc_id UUID;
  i INT;
  wiki_titles TEXT[] := ARRAY[
    'Architecture Decision Record',
    'Onboarding Guide',
    'API Design Standards',
    'Testing Strategy',
    'Deployment Runbook',
    'Incident Response Plan',
    'Code Review Checklist',
    'Performance Tuning Guide',
    'Security Best Practices',
    'Database Schema Reference',
    'Frontend Component Library',
    'Backend Service Map',
    'Sprint Retrospective Template',
    'Meeting Notes Template',
    'Technical Debt Register'
  ];
  long_content JSONB;
BEGIN
  SELECT id INTO ws_id FROM workspaces LIMIT 1;
  SELECT id INTO creator_id FROM users WHERE email = 'dev@ship.local';
  SELECT array_agg(id) INTO user_ids FROM users;

  -- Create a larger content block for realistic document sizes
  long_content := '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Overview"}]},{"type":"paragraph","content":[{"type":"text","text":"This document covers the essential guidelines and procedures for our development workflow. It includes detailed instructions, examples, and references to other documentation that team members should be familiar with."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Details"}]},{"type":"paragraph","content":[{"type":"text","text":"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."}]},{"type":"paragraph","content":[{"type":"text","text":"Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium."}]}]}'::jsonb;

  FOR i IN 1..150 LOOP
    INSERT INTO documents (
      title, document_type, workspace_id, created_by,
      content, properties
    ) VALUES (
      wiki_titles[1 + (i % 15)] || ' v' || ((i / 15) + 1),
      'wiki',
      ws_id,
      user_ids[1 + (i % array_length(user_ids, 1))],
      long_content,
      '{}'::jsonb
    );
  END LOOP;
END $$;
