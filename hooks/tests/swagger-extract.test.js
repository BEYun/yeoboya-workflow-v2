const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const swagger = require('../lib/swagger-extract');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

test('parseSwagger: Swagger 2.0 엔드포인트를 나열한다', () => {
  const md = swagger.parseSwagger(loadFixture('swagger-2.0.json'));
  assert.match(md, /`GET \/users\/\{id\}` — 사용자 조회/);
  assert.match(md, /`POST \/users` — 사용자 생성/);
});

test('parseSwagger: Swagger 2.0 요청/응답 DTO를 추출한다', () => {
  const md = swagger.parseSwagger(loadFixture('swagger-2.0.json'));
  assert.match(md, /요청: `CreateUser`/);
  assert.match(md, /응답: `User`/);
  assert.match(md, /#### User/);
  assert.match(md, /- id: integer \(required\)/);
  assert.match(md, /- name: string/);
});

test('parseSwagger: OpenAPI 3.x components.schemas와 배열 응답을 처리한다', () => {
  const md = swagger.parseSwagger(loadFixture('openapi-3.0.json'));
  assert.match(md, /`GET \/orders` — 주문 목록/);
  assert.match(md, /응답: `Order\[\]`/);
  assert.match(md, /요청: `CreateOrder`/);
  assert.match(md, /#### Order/);
});

test('parseSwagger: endpoints 필터가 부분집합만 반환한다', () => {
  const md = swagger.parseSwagger(loadFixture('swagger-2.0.json'), { endpoints: ['post'] });
  assert.match(md, /`POST \/users`/);
  assert.doesNotMatch(md, /`GET \/users\/\{id\}`/);
});

test('parseSwagger: 참조된 DTO가 없으면 안내를 낸다', () => {
  const md = swagger.parseSwagger({ paths: { '/ping': { get: { summary: 'ping' } } } });
  assert.match(md, /`GET \/ping`/);
  assert.match(md, /참조된 DTO 없음/);
});
