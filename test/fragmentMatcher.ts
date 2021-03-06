import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';
import { IntrospectionFragmentMatcher } from '../src/data/fragmentMatcher';

import mockQueryManager from './mocks/mockQueryManager';

describe('IntrospectionFragmentMatcher', () => {

  const introspectionQuery = gql`{
    __schema {
      types {
        kind
        name
        possibleTypes {
          name
        }
      }
    }
  }`;

  it('will throw an error if match is called before init is done', () => {
    const ifm = new IntrospectionFragmentMatcher();
    assert.throws( () => (ifm.match as any)(), /called before/ );
  });

  it('can be seeded with an introspection query result', () => {
    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [{
            kind: 'UNION',
            name: 'Item',
            possibleTypes: [{
              name: 'ItemA',
            }, {
              name: 'ItemB',
            }],
          }],
        },
      },
    });

    const store = {
      'a': {
        __typename: 'ItemB',
      },
    };

    const idValue = {
      type: 'id',
      id: 'a',
      generated: false,
    };

    const readStoreContext = {
      store,
      returnPartialData: false,
      hasMissingField: false,
      customResolvers: {},
    };

    assert.equal(ifm.match(idValue as any, 'Item', readStoreContext), true );
    assert.equal(ifm.match(idValue as any, 'NotAnItem', readStoreContext), false );
  });

  it('works if introspection query has to be fetched', () => {
    const ifm = new IntrospectionFragmentMatcher();

    const introspectionResultData = {
      __schema: {
        types: [{
          kind: 'UNION',
          name: 'Item',
          possibleTypes: [{
            name: 'ItemA',
          }, {
            name: 'ItemB',
          }],
        }],
      },
    };

    const manager = mockQueryManager({
          request: { query: introspectionQuery },
          result: { data: introspectionResultData },
        });

    const store = {
      'a': {
        __typename: 'ItemB',
      },
    };

    const idValue = {
      type: 'id',
      id: 'a',
      generated: false,
    };

    const readStoreContext = {
      store,
      returnPartialData: false,
      hasMissingField: false,
      customResolvers: {},
    };

    return ifm.ensureReady(manager)
    .then( () => {
      assert.equal(ifm.match(idValue as any, 'Item', readStoreContext), true );
      assert.equal(ifm.match(idValue as any, 'NotAnItem', readStoreContext), false );
    });
  });

  it('does not need to fetch if introspection result is cached', () => {
    const ifm = new IntrospectionFragmentMatcher();

    const introspectionResultData = {
      __schema: {
        types: [{
          kind: 'UNION',
          name: 'Item',
          possibleTypes: [{
            name: 'ItemA',
          }, {
            name: 'ItemB',
          }],
        }],
      },
    };

    const client = new ApolloClient({
      fragmentMatcher: ifm,
      networkInterface: { query: () => { throw new Error('Must not fetch from server!'); } },
    });

    client.writeQuery({ query: introspectionQuery, data: introspectionResultData });
    client.writeQuery({ query: gql`{ a }`, data: { a: '1' } });

    return client.query({ query: gql`{ a }` })
    .then( res => {
      return assert.deepEqual(res.data, { a: '1' });
    });
  });

  it('will fetch introspection query only once even if called multiple times', () => {
    const ifm = new IntrospectionFragmentMatcher();

    const introspectionResultData = {
      __schema: {
        types: [{
          kind: 'UNION',
          name: 'Item',
          possibleTypes: [{
            name: 'ItemA',
          }, {
            name: 'ItemB',
          }],
        }],
      },
    };

    const manager = mockQueryManager({
          request: { query: introspectionQuery },
          result: { data: introspectionResultData },
        });


    const p = ifm.ensureReady(manager)
    .then( () => {
      // test that it doesn't fetch again if it's already ready
      assert.doesNotThrow(() => ifm.ensureReady(manager));
    });
    // test that calling it twice in the same tick doesn't cause problems
    assert.doesNotThrow(() => ifm.ensureReady(manager));
    return p;
  });
});
